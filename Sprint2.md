# Sprint 2 — Boletas, Pagos, Roles y Vinculación de Solicitudes

Directrices de arquitectura y producto para el sprint del proyecto "Okima Compras" (React + Vite + Supabase). Léelas completas antes de generar o modificar migraciones SQL, políticas RLS o componentes. Este documento **reemplaza** la decisión "Sin login; RLS permisivo" de `CLAUDE.md`; hay que actualizar ese archivo al cerrar el sprint.

## 0. Convenciones y orden de ejecución

**Convenciones**

* Se mantienen los nombres actuales del esquema: `insumos` (insumos Okima), `insumos_proveedores`, `detalle_facturas`, `solicitudes_compra`, y el prefijo `id_` en las FK (`id_factura`, `id_insumo_proveedor`). Las tablas nuevas siguen esa misma convención: `boletas`, `detalle_boletas`, `pagos`, `perfiles`, `insumos_proveedores_okima`.
* Todos los cambios sobre tablas existentes se hacen con `ALTER TABLE ... RENAME` / `ADD COLUMN IF NOT EXISTS`, nunca con drop/create, para conservar datos.
* Cada migración es un archivo SQL numerado, con su script de reversa, y se prueba primero en un proyecto o rama de staging de Supabase.
* Una migración por punto de la sección 1, en el orden siguiente:
  1. Renombrado (1.1)
  2. `notas` (1.2)
  3. `perfiles`, autenticación y RLS por rol (1.7 y 2)
  4. N:M de insumos (1.6)
  5. Boletas y detalle (1.4)
  6. Estado de anulación (1.8)
  7. Pagos y migración de datos históricos (1.3)
  8. Vinculación de solicitudes (1.5)
  9. UI (3)

## 1. Base de datos (Supabase / PostgreSQL)

### 1.1 Renombrado: "Otros Gastos" → "Boletas"

* `otros_gastos` → `boletas`, con `ALTER TABLE ... RENAME` (conserva datos y FKs).
* Se crea `detalle_boletas` (ver 1.4) como "Líneas de Boletas".
* Renombrar también: `plantillas_gastos_recurrentes.id_plantilla_recurrente` y toda referencia en vistas, panel de resumen, rutas, textos de UI y nombres de archivo CSV exportados.
* Los gastos recurrentes (Arriendo, Sueldos, Pago IVA) se siguen registrando como boletas creadas desde una plantilla.

### 1.2 Campo `notas` universal

* `ADD COLUMN IF NOT EXISTS notas TEXT` en: `proveedores`, `insumos_proveedores`, `insumos`, `solicitudes_compra`, `facturas`, `detalle_facturas`, `boletas`, `detalle_boletas`. (`pagos` ya la trae. Las tablas que ya la tienen no se tocan.)
* **UI:** si `notas` está vacía no ocupa espacio. Si tiene contenido, se muestra de forma prominente (banner o chip destacado visible en el listado y en el detalle) para alertar de indicaciones de interacción.

### 1.3 Pagos (egresos) y ventas a crédito

Se separa la deuda (factura / boleta) del flujo de caja (pago).

**Tabla `pagos`**

* `id` (uuid, PK), `created_at`.
* `monto` (numeric, `CHECK (monto > 0)`).
* `fecha_pago` (date).
* `id_factura` (uuid, FK a `facturas`, null) e `id_boleta` (uuid, FK a `boletas`, null).
* `notas` (text, null).
* `CHECK (num_nonnulls(id_factura, id_boleta) = 1)`: un pago pertenece a una factura o a una boleta, nunca a ambas ni a ninguna.
* Índices sobre `fecha_pago`, `id_factura` e `id_boleta`.
* FK sin `ON DELETE CASCADE`: un documento con pagos no se puede borrar mientras tenga pagos (el borrado es solo de Admin; ver sección 2).

**Estado de pago**

* `estado_pago` ('pagado', 'pendiente', 'parcial') es **calculado** en una vista (`monto pagado` vs `total` del documento), no un campo físico, para que no se desincronice. Un documento anulado se muestra como "anulado" sin estado de pago.
* Sobrepago (suma de pagos > total): se avisa en la UI y se permite con confirmación.

**Resumen de gastos**

* Solo suma la tabla `pagos`, de modo que un gasto a crédito cuenta en el mes en que se paga cada cuota.
* **Se excluyen los pagos de documentos anulados.**
* La asignación a centro de costo sale del documento al que pertenece el pago. Un pago parcial de una factura con varias subcategorías se prorratea según el peso de cada subcategoría en el neto de la factura. Si el documento no tiene subcategoría, queda "Sin centro de costo".
* El indicador de IVA del mes en el listado de facturas (calculado sobre facturas) se mantiene tal cual; se revisa en este sprint que siga coherente.

**Migración de datos históricos (OBLIGATORIO, en la misma migración)**

* Para cada factura y cada boleta ya ingresada, crear un registro en `pagos` por el monto total con `fecha_pago` = fecha del documento, nota "Migración histórica: pago al contado".
* Sin esto, el gasto histórico desaparece del resumen. Debe ser idempotente (no duplicar si se ejecuta dos veces) y verificar al final que `Σ pagos` = `Σ totales` de los documentos migrados.

### 1.4 Boletas y detalle de boletas

`boletas` (la actual `otros_gastos`) funciona como cabecera que agrupa varias líneas, igual que `facturas`.

* **Cabecera `boletas`:** `id`, `created_at`, `concepto`, `id_subcategoria` (opcional), `id_plantilla_recurrente` (opcional), `id_proveedor` (opcional), `fecha`, `numero_documento` (opcional), `monto` (total, en CLP), `estado_documento` (ver 1.8), `notas`.
* **Detalle `detalle_boletas`:** `id`, `id_boleta` (FK a `boletas`, `ON DELETE CASCADE`), `descripcion` (text), `id_insumo_proveedor` (opcional), `cantidad`, `precio`, `subtotal` (calculado por la interfaz), `id_solicitud_compra` (opcional, ver 1.5), `notas`.
* Las boletas no discriminan IVA (es un monto total).
* Las líneas de boleta **mueven stock** igual que las de factura (ver 1.6): si la línea tiene `id_insumo_proveedor` vinculado en la pivote, suma stock. Las líneas sin `id_insumo_proveedor` (ej. arriendo, sueldos) no tocan stock.
* Una boleta existente se migra con una línea única que replica su concepto y monto.

### 1.5 Vinculación de solicitudes con líneas

Una solicitud de compra puede originar la compra de una línea de factura **o** de una línea de boleta, **nunca ambas**.

* **Decisión (OBLIGATORIA):** el vínculo se mantiene **en la línea**, como hoy: `detalle_facturas.id_solicitud_compra` ya existe y se **añade** `detalle_boletas.id_solicitud_compra`. Así varias líneas pueden apuntar a la misma solicitud (compras parciales) y los triggers actuales se conservan. No se usan tablas polimórficas.
* La regla "nunca ambas" se garantiza con una función/trigger de validación que impide que una solicitud tenga líneas de factura y de boleta a la vez (un `CHECK` no puede ver otras filas). Cubre insertar y actualizar en ambas tablas.
* El trigger vigente que marca la solicitud como 'Comprada' se extiende a `detalle_boletas`.
* Una solicitud con vínculos existentes sigue la regla vigente: al pasar a 'Pendiente' o 'Cancelada' se avisa de las líneas asociadas, sin bloquear.

### 1.6 Insumos proveedor ↔ insumos Okima: relación N:M

Casos: varios proveedores venden el mismo producto físico, y un producto del proveedor (ej. resma de papel mercurio) se convierte en varios formatos internos.

* **Tabla pivote `insumos_proveedores_okima`:** `id`, `created_at`, `id_insumo_proveedor`, `id_insumo_okima`, `factor_conversion` (numeric, `CHECK (factor_conversion > 0)`), `UNIQUE (id_insumo_proveedor, id_insumo_okima)`.
* **Semántica del factor:** unidades Okima que se obtienen por cada unidad del proveedor. Tres proveedores que venden el mismo tazón: 3 filas apuntando al mismo `id_insumo_okima` con factor 1. Una resma que rinde 2000 hojas de corte: factor 2000.
* **Migración de datos:** cada `insumos_proveedores.id_insumo_okima` existente pasa a la pivote con `factor_conversion = COALESCE(cantidad_formato, 1)`. Luego se elimina `id_insumo_okima` de `insumos_proveedores`.
* **Trigger de stock reescrito:** al guardar una línea de factura **o de boleta**, para **cada** fila de la pivote del `insumo_proveedor`: `insumos.qty += cantidad × factor_conversion`. Si no hay filas, no se registra stock (regla vigente: vincular después no aplica retroactivamente).
* **Reversa:** lo aplicado se guarda en una tabla hija `movimientos_stock` (`id`, `id_detalle_factura` null, `id_detalle_boleta` null, `id_insumo`, `qty`, `CHECK (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1)`), reemplazando `id_insumo_stock` / `qty_stock`, porque ahora una línea puede afectar varios insumos. Editar o borrar la línea (o el documento en cascada) o **anular la factura o boleta** revierte exactamente lo sumado.
* **Vinculación desde Facturas (regla vigente):** si la línea tiene solicitud y su `insumo_proveedor` no tiene vínculo, la interfaz pregunta ("Vincular" / "No vincular") y solo con confirmación explícita crea la fila en la pivote, pidiendo el `factor_conversion` (por defecto 1). Nunca en silencio ni al crear el insumo al vuelo. La vista "Por vincular" lista los `insumos_proveedores` sin ninguna fila en la pivote.

### 1.7 Perfiles de usuario

* Tabla `perfiles`: `id` (uuid, PK, FK 1:1 a `auth.users`, `ON DELETE CASCADE`), `rol` (ENUM `productor` | `contador` | `admin`), `nombre_mostrar` (text), `created_at`.
* Trigger `on auth.users insert` que crea el perfil a partir de los metadatos del usuario.
* `solicitudes_compra.solicitante` es texto libre histórico. Se agrega `id_solicitante` (uuid, null, FK a `perfiles`) y la migración lo completa cuando el texto coincide con `nombre_mostrar` (sin distinguir mayúsculas). Los valores sin coincidencia quedan solo como texto; no se descartan ni se inventan usuarios.
* Se agrega `created_by` (uuid, FK a `perfiles`, null) a `solicitudes_compra`, `facturas`, `boletas` y `pagos` para trazabilidad. Los históricos quedan en null.

### 1.8 Estado "Anulado" en Facturas y Boletas

* `facturas` y `boletas` ganan `estado_documento` (ENUM `vigente` | `anulado`, default `vigente`), más `anulado_por` (uuid, null), `anulado_at` (timestamptz, null) y `motivo_anulacion` (text, null).
* `solicitudes_compra` ya maneja este concepto con su estado **'Cancelada'**: se mantiene ese valor y se muestra en la UI como "Anulada". No se renombra el valor en la base.
* **Efectos de anular un documento:**
  * Se **revierte el stock** aplicado por sus líneas (misma lógica que borrar la línea, pero conservando el registro).
  * Se **excluye** de totales, del resumen de gastos y de cualquier cálculo de IVA o deuda.
  * Si el documento tiene pagos registrados, la UI pide confirmación explícita y avisa cuántos pagos y qué monto; los pagos se conservan pero dejan de contar en el resumen mientras el documento esté anulado.
  * Las solicitudes vinculadas a sus líneas se avisan (no se cambian automáticamente), igual que la regla vigente al cancelar.
* Un documento anulado no se puede editar. Solo el Admin puede volverlo a `vigente`.
* **Un documento anulado nunca se borra físicamente** desde la UI para Contador/Productor; el borrado es exclusivo del Admin.

## 2. Autenticación y autorización

El sistema no tiene registro abierto. Los usuarios se crean con un script de seeding (Node, `supabase.auth.admin.createUser`, con la service-role key en una variable de entorno local, **nunca** en el frontend ni en el repo).

| Usuario | Rol | Email (login) |
| ----- | ----- | ----- |
| Richard | Productor | richard@okima.cl |
| Jhona | Productor | jhona@okima.cl |
| Ana | Productor | ana@okima.cl |
| Gerardo | Contador | gerardo@okima.cl |
| Tac | Admin | tac@okima.cl |
| Jorge | Admin | jorge@okima.cl |

* **Clave inicial común:** el valor de `SEED_PASSWORD`. No se escribe en el código del script: se lee de la variable de entorno `SEED_PASSWORD`. Es una clave compartida y débil: el script marca a cada usuario con "debe cambiar la clave" y el frontend la exige en el primer login. Mientras no se cambie, las claves deben considerarse temporales.
* Los emails de login son `nombre@okima.cl` (confirmado).
* El script es idempotente (si el usuario existe, no lo duplica ni cambia su clave).

### 2.1 Matriz de permisos (C = crear, R = leer, U = editar, D = borrar)

| Entidad / vista | Productor | Contador | Admin |
| ----- | ----- | ----- | ----- |
| Solicitudes de compra | CRU | CRU | CRUD |
| Proveedores y sus catálogos (`insumos_proveedores`, "Por vincular") | R | CRU | CRUD |
| Insumos Okima y vínculos N:M | CRU | CRU | CRUD |
| Facturas y líneas (incluye anular) | — | CRU + anular | CRUD |
| Boletas y líneas (incluye anular) | — | CRU + anular | CRUD |
| Pagos | — | CR | CRUD |
| Resumen de gastos | — | — | R |
| Centros de costo (categorías y subcategorías) | — | — | CRUD |
| Plantillas de gastos recurrentes | — | — | CRUD |

* **Borrar (D) es exclusivo del Admin.** Productor y Contador corrigen editando o anulando.
* El Contador puede cancelar solicitudes y anular facturas y boletas, pero no borrarlas.
* Los combos de selección que muestran categorías y subcategorías (p. ej. al crear un insumo al vuelo) deben ser **de lectura** para Productor y Contador, aunque la vista "Centros de costo" sea solo Admin.

### 2.2 Aplicación de la matriz

* **Backend (obligatorio):** reemplazar el RLS permisivo por políticas por rol en todas las tablas. Todo el acceso requiere usuario autenticado. Se usa una función `public.rol_actual()` con `SECURITY DEFINER` y `search_path` fijo que lee `perfiles`, para evitar recursión en las políticas. Sin RLS, las guardas del frontend no protegen nada.
* **Frontend:** `ProtectedRoute` basado en el rol, que oculta las entradas del menú y bloquea las rutas no permitidas. Es solo ergonomía; la seguridad real es el RLS.
* La service-role key solo se usa en el script de seeding.

## 3. UI/UX

### 3.1 Switch "¿Pagado al contado?"

* La pantalla de crear Factura/Boleta incluye el switch "¿Pagado al contado?".
* Si es `true`, el documento, sus líneas **y** el pago por el monto total se guardan en **una sola transacción**, mediante una función RPC de Postgres (`SECURITY INVOKER`, para respetar el RLS). La `fecha_pago` es la fecha del documento y se puede editar. Si falla cualquier paso, no se guarda nada.
* Si es `false`, solo se guarda el documento; los pagos se agregan después en la pestaña "Cuotas/Pagos" del detalle (ver Pagos en 2.1 para los permisos).
* Si se edita el total de un documento pagado al contado, la UI avisa que el pago ya registrado no se ajusta solo y ofrece corregirlo.

### 3.2 Modal de vinculación de solicitudes

* El dropdown actual para vincular línea ↔ solicitud se reemplaza por un botón que abre una **Modal** con las solicitudes disponibles.
* **Disponibles:** solicitudes en estado 'Pendiente' que no tengan líneas de boleta (si la línea es de factura) ni líneas de factura (si es de boleta), según la regla de 1.5.
* **Orden:** primero las solicitudes cuyo `insumo` coincide con el insumo de la línea que se está ingresando (según la pivote N:M); después el resto por urgencia (Alta → Media → Baja) y luego por `fecha_esperada`.
* La modal permite buscar por texto (insumo o solicitante).
* Conserva el aviso y la confirmación de vínculo `insumo_proveedor` ↔ `insumo` descritos en 1.6.

### 3.3 Filtros y vinculación al vuelo

* Las vistas de líneas de Facturas y de Boletas tienen un filtro "No vinculadas a solicitudes".
* Vinculación rápida desde la tabla: dropdown inline + botón de confirmar. Para las solicitudes pendientes sueltas (sin ninguna línea asociada), el mismo mecanismo en sentido inverso: elegir una línea de factura o de boleta sin solicitud.

### 3.4 Paleta de colores (tokens)

Actualiza `tailwind.config.js` (o variables CSS) con:

* `primary.DEFAULT: #0098C0`, `primary.light: #1BAAC0`.
* `accent.DEFAULT: #F47B4C`, `accent.dark: #F15A24`.
* Antes de usar texto blanco sobre `#1BAAC0` o `#F47B4C`, verificar el contraste (WCAG AA); si no cumple, usar texto oscuro o el tono más oscuro del par.

## 4. Criterios de aceptación

* Cada migración se aplica y se revierte sin errores en staging, y no deja registros huérfanos.
* `Σ pagos` migrados = `Σ totales` de facturas y boletas existentes.
* Un Productor no puede leer ni escribir facturas, boletas ni pagos, ni siquiera llamando a la API directamente.
* Anular una factura o boleta con líneas vinculadas a insumos revierte el stock y desaparece del resumen.
* Guardar una línea de boleta con insumo vinculado suma stock, y editarla o borrarla lo revierte exactamente.
* Una solicitud no puede quedar con líneas de factura y de boleta a la vez.
* El switch "Pagado al contado" no deja nunca una factura sin pago ante un fallo a mitad de guardado.
* El resumen de gastos solo suma `pagos` de documentos vigentes.

## 5. Pendientes por confirmar

* Si los pagos de un documento anulado, al volver a `vigente`, vuelven a contar sin más pasos (1.8).
