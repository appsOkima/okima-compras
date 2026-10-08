# Contexto del Proyecto: Sistema de Compras y Recepción "Okima"

*Guarda este archivo como `CLAUDE.md` en la raíz de tu repo cuando trabajes en Claude Code / VS Code — así lo carga automáticamente en cada sesión nueva.*

## Decisiones clave

Resumen operativo del sistema tal como quedó al cerrar el Sprint 2 y su ajuste posterior, la migración 13 (especificación en `Sprint2.md`, con su sección 6 de estado y desviaciones). El razonamiento de cada punto está en `historial-decisiones.md`, aparte para no cargar cada sesión con la trazabilidad completa.

- Login con Supabase Auth (6 usuarios sembrados por script, sin registro abierto), roles `productor` / `contador` / `admin` y RLS por rol en todas las tablas; sin acceso anónimo.
- Todo en CLP, sin excepciones.
- Creación al vuelo para `insumo_okima`, `proveedor` e `insumo_proveedor` (ver sección dedicada) — varios campos quedan nullable.
- "Otros Gastos" pasó a **Boletas**: cabecera + `detalle_boletas`; `boletas.monto` es el total de las líneas. Una boleta no tiene `concepto` (la migración 13 lo eliminó) ni mueve stock: sus líneas no llevan insumo del proveedor.
- **Deuda y caja separadas:** facturas y boletas son la deuda; `pagos` es el flujo de caja. El Resumen de gastos suma solo `pagos` de documentos vigentes, por mes de `fecha_pago`.
- **Stock N:M:** `insumos_proveedores_okima` (pivote con `factor_conversion`) vincula insumos del proveedor con insumos Okima. Cada línea de **factura** (las boletas no) genera filas en `movimientos_stock`, que mantienen `insumos.qty` por trigger.
- **Anulado, no borrado:** facturas y boletas se anulan (revierte el stock, sale de totales y Resumen); las solicitudes usan 'Cancelada' en la base y "Anulada" en la UI. Borrar es solo del Admin.
- `categorias` = centros de costo, con `subcategorias`; `insumos`, `boletas` y `plantillas_gastos_recurrentes` referencian solo `id_subcategoria`.
- Gasto recurrente vía `plantillas_gastos_recurrentes` (monto editable), no un valor fijo.
- `venta_directa` en `insumos` habilita `precio_venta`.

---

## Objetivo del Proyecto
Desarrollar un MVP (App Web) para gestionar solicitudes de compra de insumos y registrar facturas de proveedores. La prioridad es una excelente experiencia de usuario (carga rápida, interfaces intuitivas) y la correcta recolección/relación de datos para exportarlos a un futuro ERP en 6 meses.

## Stack Tecnológico Requerido
- **Frontend:** React (usando Vite), Tailwind CSS para estilos rápidos (v4, tokens de tema en `src/index.css`).
- **Iconos y Componentes:** `lucide-react` para iconos. Componentes limpios y funcionales (tipo shadcn/ui o Tailwind puro).
- **Backend y Base de Datos:** Supabase (PostgreSQL) usando `@supabase/supabase-js`.
- **Navegación:** `react-router-dom`.
- **Autenticación:** Supabase Auth con roles (ver sección siguiente).
- **Pruebas:** `vitest` (`npm test`) para la lógica pura de `src/lib/`.

---

## Autenticación y roles

Sin registro abierto: `scripts/seed-usuarios.mjs` crea 6 usuarios (`nombre@okima.cl`): Richard, Jhona, Ana (productor), Gerardo (contador), Tac y Jorge (admin). El rol viaja en `app_metadata` (solo editable con service role), nunca en `user_metadata`; un trigger crea la fila de `perfiles` (`rol` ENUM, `nombre_mostrar`). La clave inicial es común (variable `SEED_PASSWORD`) y el primer login exige cambiarla. La función `public.rol_actual()` (SECURITY DEFINER) alimenta las políticas RLS; la service-role key solo se usa en el script de seeding.

Matriz resumida (C crear, R leer, U editar, D borrar; fuente: `Sprint2.md` §2.1 y migración 11):

| Entidad | Productor | Contador | Admin |
| --- | --- | --- | --- |
| Solicitudes | CRU | CRU | CRUD |
| Proveedores e `insumos_proveedores` | R | CRU | CRUD |
| Insumos Okima y vínculos N:M | CRU | CRU | CRUD |
| Facturas y boletas (con líneas; incluye anular) | — | CRU + anular | CRUD + reactivar |
| Pagos | — | CR | CRUD |
| Resumen, Centros de Costo, Plantillas de gasto recurrente | — | — | R / CRUD / CRUD |

Borrar es solo del Admin. Excepciones de la migración 11: el Contador puede borrar su propia cabecera recién creada, sin líneas ni pagos (rollback de un guardado fallido), y borrar líneas de factura/boleta. Riesgo conocido: el Productor edita `insumos` completo, incluido `qty`. Las guardas de la interfaz (`src/lib/permisos.js`, `ProtectedRoute`) son solo ergonomía; la seguridad real es el RLS (un UPDATE/DELETE denegado afecta 0 filas sin error).

---

## Creación al vuelo (autocompletar + crear)

Patrón de UX para tres entidades: el input es un combobox con autocompletado sobre los registros existentes; si el texto escrito no calza con ninguno, permite crear un registro nuevo con ese texto como `nombre` (más los campos adicionales obligatorios de cada caso). El resto de los campos queda vacío y se completa después en el Mantenedor correspondiente.

- **Solicitudes de Compra → `insumo_okima`:** captura `nombre` + `id_subcategoria` (ambos obligatorios). El resto queda nulo.
- **Gestionar Facturas → `proveedor`:** primero `nombre` (para verificar si ya estaba ingresado), luego `rut` (obligatorio). El resto queda nulo.
- **Gestionar Facturas → `insumo_proveedor`:** captura `nombre` y hereda `id_proveedor` del proveedor ya seleccionado en esa factura. **No se vincula a ningún insumo Okima al crearlo** (no hay fila en la pivote); se vincula después: el administrador en su revisión semanal ("Por vincular", Función 4) o, con confirmación explícita, al asociar la línea de factura a una solicitud (Función 2).

**Duplicados:** antes de ofrecer "crear nuevo", el autocompletado busca coincidencias sin distinguir mayúsculas/tildes/espacios y avisa si hay algo parecido, en vez de crear silenciosamente un registro repetido. Es un chequeo de aplicación, no un `UNIQUE` en la base.

Consecuencia: en los Mantenedores hay un filtro "incompletos" que muestra los registros creados al vuelo a los que les falten datos.

---

## Modelo de Datos (Esquema Relacional)

Estado final tras el Sprint 2; el esquema completo y ejecutable está en `supabase/schema.sql`. Todas las tablas usan `id` (uuid, `gen_random_uuid()`) y `created_at`. `created_by` (FK a `perfiles`) lo fija un trigger desde `auth.uid()` en `solicitudes_compra`, `facturas`, `boletas` y `pagos`.

**`notas` (text, opcional):** existe en `proveedores`, `insumos_proveedores`, `insumos`, `solicitudes_compra`, `facturas`, `boletas` y `pagos`. **Las líneas (`detalle_facturas`, `detalle_boletas`) no llevan notas.** Vacía no ocupa espacio; con contenido se destaca en formulario y ficha. No aparece en las filas de las tablas; en la hoja impresa de Pendientes salen las de la solicitud, sus proveedores sugeridos, sus insumos de catálogo vinculados y el insumo Okima.

### 1. proveedores
`nombre`, `codigo` (nullable), `rut` (obligatorio siempre, incluso al vuelo), `direccion_1/2`, `email_1/2`, `fono_1/2`, `datos_transferencia`, `notas` (opcionales).

### 2. insumos (insumos internos de Okima)
`nombre`, `id_subcategoria` (FK, obligatorio siempre; la categoría sale de la subcategoría), `codigo`, `ancho`/`alto`/`profundidad` (mm), `venta_directa` (boolean), `precio_venta` (aplica si `venta_directa`), `descripcion`, `notas` — todos nullable salvo nombre y subcategoría. `qty` (numeric, default 0): lo mantiene el trigger de `movimientos_stock`.

### 3. insumos_proveedores (catálogo) y pivote
`nombre`, `id_proveedor` (FK), `codigo`, `precio_clp`, dimensiones, `fecha_actualizacion`, `link_insumo`, `descripcion`, `notas` (nullable). `cantidad_formato` y `formato_unidad` son **descriptivos**: ya no gobiernan el stock. **No tiene `id_insumo_okima`.**

**`insumos_proveedores_okima` (pivote N:M):** `id_insumo_proveedor`, `id_insumo_okima`, `factor_conversion` (numeric `> 0`: unidades Okima por cada unidad del proveedor), `UNIQUE (id_insumo_proveedor, id_insumo_okima)`. Ej.: tres proveedores del mismo tazón → 3 filas al mismo insumo con factor 1; una resma que rinde 2000 hojas → factor 2000.

### 4. solicitudes_compra
`solicitante` (texto libre histórico), `id_solicitante` (FK a `perfiles`, nullable; la migración 06 lo completó por nombre), `id_insumo_okima` (FK), `cantidad_solicitada`, `nivel_urgencia` (ENUM Baja < Media < Alta), `fecha_esperada` (opcional), `estado` ('Pendiente', 'Comprada', 'Cancelada'; default 'Pendiente'), `notas`, `created_by`. **'Cancelada' en la base se muestra "Anulada" en la UI.**

### 5. facturas (cabecera)
`id_proveedor`, `numero_factura` (`UNIQUE (id_proveedor, numero_factura)`, **intacto aunque la factura esté anulada**: sigue ocupando su número), `fecha`, `descuento_pct` (0–100, único dato de totales que ingresa el usuario), `neto_total`/`iva`/`total` (calculados por la interfaz y guardados: neto = Σ subtotales × (1 − `descuento_pct`/100), IVA 19 % del neto, total = neto + IVA, redondeados al peso), `notas`, `created_by`. Anulación: `estado_documento` (ENUM `vigente`/`anulado`, default `vigente`), `anulado_por`, `anulado_at`, `motivo_anulacion`.

### 6. detalle_facturas (líneas)
`id_factura` (cascade), `id_insumo_proveedor`, `id_solicitud_compra` (opcional, `on delete set null`), `cantidad`, `precio_neto`, `descuento_pct`, `subtotal` (calculado por la interfaz: cantidad × precio_neto × (1 − `descuento_pct`/100), al peso). **Sin `id_insumo_stock`/`qty_stock`**: el stock aplicado vive en `movimientos_stock`. Sin notas.

### 7. boletas (cabecera) y detalle_boletas
Boletas: gastos que no son solo compra de insumos con stock (arriendo, sueldos, IVA, servicios, o compras con boleta). Cabecera (sin `concepto`: se identifica por fecha, subcategoría, proveedor, N° de documento, notas, monto y líneas; la interfaz la nombra con la descripción de su primera línea, «(+N más)» si hay varias, o «Boleta sin líneas»): `id_subcategoria` (opcional), `id_plantilla_recurrente` (opcional), `id_proveedor` (opcional), `fecha`, `numero_documento` (opcional), `monto` (**total de las líneas**, CLP, calculado por la interfaz; sin IVA discriminado), `notas`, `created_by`, más los mismos campos de anulación que facturas.

`detalle_boletas`: `id_boleta` (cascade), `descripcion`, `id_solicitud_compra` (opcional, `set null`), `cantidad`, `precio`, `subtotal` (= round(cantidad × precio), lo calcula la interfaz). **Sin insumo del proveedor** (no hay stock ni vínculo con insumos Okima en boletas) y sin notas. Las boletas anteriores se migraron a una línea única; la migración 13 exige que toda boleta tenga una línea con descripción.

### 8. movimientos_stock
Una fila por línea de factura e insumo Okima afectado: `id_detalle_factura` (NOT NULL, cascade; solo origen factura), `id_insumo`, `qty` (= cantidad × `factor_conversion`), `revertido` (boolean). Triggers: insertar suma a `insumos.qty`, borrar resta, y `revertido = true` (documento anulado) conserva el registro pero ya no cuenta; reactivar lo devuelve a `false` reaplicando exactamente `qty`. `id_insumo` sin cascade: no se puede borrar un insumo con movimientos.

### 9. pagos
`monto` (`> 0`), `fecha_pago`, `id_factura` **o** `id_boleta` (`CHECK num_nonnulls = 1`, FK **sin cascade**: un documento con pagos no se puede borrar), `notas`, `created_by`. La **vista `vista_estado_pago`** (una fila por factura/boleta) calcula `pagado`, `saldo` y `estado_pago` (`anulado` | `pagado` | `pendiente` | `parcial`); no es campo físico. El sobrepago (pagado > total) figura como `pagado` con saldo negativo: la UI avisa y pide confirmación. La migración 10 creó un pago histórico por cada documento existente, con la fecha del documento.

### 10. perfiles
`id` (FK 1:1 a `auth.users`, cascade), `rol` (ENUM `productor`/`contador`/`admin`), `nombre_mostrar`. Ver "Autenticación y roles".

### 11. categorias, subcategorias y plantillas
`categorias` (centros de costo: `nombre`, `activo`) y `subcategorias` (`id_categoria` obligatorio, `nombre`, `descripcion` = "Items Incluidos", `activo`). Semilla desde `centros_de_costo.csv`: 10 categorías y 34 subcategorías. `plantillas_gastos_recurrentes` (`nombre`, `id_subcategoria` opcional, `monto_default` editable, `activo`): semilla Arriendo → Infraestructura, Sueldos → Remuneraciones, Pago IVA → Impuestos y Finanzas (monto 0).

## Vistas

- **`vista_solicitudes_pendientes`**: solicitudes 'Pendiente' ordenadas por urgencia (Alta → Media → Baja), con insumo, `fecha_esperada`, proveedores sugeridos (vía la pivote) y las notas que se imprimen. Alimenta la lista y la impresión de la Función 1.
- **`vista_estado_pago`**: ver tabla 9.

---

## Reglas de negocio vigentes

- **Stock (solo facturas):** al guardar una línea de factura, por **cada** fila de la pivote de su `insumo_proveedor` se crea un `movimientos_stock` con `qty = cantidad × factor_conversion` y `insumos.qty` sube. Sin fila en la pivote no hay stock, y vincular después no lo aplica retroactivamente. Editar o borrar la línea (o el documento, en cascada) lo revierte exacto; anular la factura marca los movimientos `revertido`. Las boletas no mueven stock y anularlas no lo toca.
- **Vínculo desde la factura, con confirmación:** si una línea de factura tiene solicitud y su `insumo_proveedor` no está vinculado, la interfaz pregunta ("Vincular" / "No vincular", cambiable hasta guardar) y pide el `factor_conversion` (por defecto 1). Nunca en silencio ni al crear el insumo al vuelo. Se aplica al guardar, antes de las líneas, solo si sigue sin vincular; si ya está vinculado a otro insumo, solo se avisa. Las boletas no tienen insumos del proveedor, así que no hay propuesta ni vínculo allí.
- **Solicitud → 'Comprada':** al insertar una línea de factura o de boleta con `id_solicitud_compra` (o asociarla después), por trigger. El estado también se gestiona a mano desde el panel de Solicitudes; al pasar a 'Pendiente' o 'Cancelada' una solicitud con líneas asociadas se avisa cuáles (facturas y boletas), sin bloquear.
- **Exclusividad:** una solicitud puede tener líneas de factura **o** de boleta, nunca ambas (trigger `validar_exclusividad_solicitud`, error 23514). Varias líneas del mismo tipo pueden apuntar a la misma solicitud. Las líneas de documentos anulados cuentan como vínculo.
- **Anulación:** Contador y Admin anulan (con motivo y confirmación; avisa pagos y solicitudes vinculadas); solo Admin reactiva. Un documento anulado no se edita, sale de totales, IVA del mes y Resumen, y sus pagos se conservan pero no cuentan.
- **Resumen de gastos:** suma `pagos` de documentos vigentes por mes de `fecha_pago`; el pago de una factura se prorratea según el subtotal de sus líneas por centro de costo; el de una boleta va a la subcategoría de la boleta; sin subcategoría, "Sin centro de costo".
- **"Pagado al contado":** al crear una factura o boleta (también desde plantilla) el switch viene **marcado por defecto**; como **último paso** del guardado (cabecera y líneas ya guardadas) la interfaz inserta un pago por el total con la fecha del documento y la nota "Pago al contado" (total ≤ 0: no se crea). No es una RPC transaccional: si el insert del pago falla, el documento queda pendiente y el mensaje lo indica. Editar el total de un documento pagado no ajusta el pago; se corrige en Cuotas/Pagos.
- **Gasto recurrente:** se elige una plantilla y se crea una boleta con una línea cuya descripción es el nombre de la plantilla; `id_subcategoria` y monto salen de la plantilla, y solo queda confirmar la `fecha` (default hoy).

---

## Funcionalidades Core

Cada rol ve solo sus secciones (matriz arriba).

1. **Solicitudes de Compra:** crear y ver `solicitudes_compra` con creación al vuelo de insumo; alertas de color por urgencia; lista y vista de impresión basadas en `vista_solicitudes_pendientes` (`@media print`); estado gestionable a mano con confirmación; pestañas Compradas y Anuladas; vinculación inversa de solicitudes sueltas a una línea de factura o boleta (Contador/Admin).
2. **Gestionar Facturas:** maestro-detalle con proveedor e insumo de proveedor al vuelo; montos calculados (solo se ingresa cantidad, precio y descuentos en %); modal de solicitudes para vincular cada línea (ordenado por coincidencia de insumo vía la pivote, urgencia y fecha tope, con búsqueda); vista de líneas (sin N° factura, descuento %, stock sumado, insumo Okima ni formato en pantalla; siguen en el CSV) con filtro "No vinculadas a solicitudes" y vinculación rápida; el botón de ver abre una página de detalle a pantalla completa (`/facturas/:id/detalle`) con datos, líneas y Cuotas/Pagos; anular y reactivar; IVA del mes (solo vigentes).
3. **Boletas:** CRUD maestro-detalle con líneas (descripción, cantidad, precio, solicitud; sin insumos), mismo modal y filtro (`/boletas/lineas`, con fecha, descripción, cantidad, precio, subtotal y solicitud), detalle a pantalla completa (`/boletas/:id/detalle`) con Cuotas/Pagos y anulación; CRUD de `plantillas_gastos_recurrentes` (solo Admin escribe); ingreso rápido de gasto recurrente. **Resumen** de gastos mensual por centro de costo (solo Admin) y sección **Pagos** global (solo Admin).
4. **Gestionar Proveedores y sus Insumos:** CRUD de `proveedores` e `insumos_proveedores` con sus vínculos N:M y factor; vista "Por vincular" (catálogo sin ninguna fila en la pivote) para la revisión semanal del administrador; filtro de incompletos.
5. **Gestionar Insumos Okima:** CRUD de `insumos`; filtro de incompletos.
6. **Centros de Costo:** CRUD de `categorias` y `subcategorias` (solo Admin; los combos que las muestran son de lectura para todos los roles).

Transversal: botón de exportación a CSV en las vistas de tabla; formato de RUT (módulo 11) y números con separador de miles y coma decimal.

---

## Convenciones de trabajo

- **Migraciones:** archivos numerados en `supabase/migraciones/` (`AAAA-MM-DD-NN-nombre.sql`), cada una con su reversa `-down.sql` y, las que lo requieren, un `-verificacion.sql`. Modifican tablas con `ALTER ... RENAME` / `ADD COLUMN IF NOT EXISTS`, nunca drop/create, para conservar datos. No hay CLI: se **aplican a mano en el SQL Editor** de Supabase, una sola vez y en orden (tabla en `README.md`). `supabase/schema.sql` se mantiene como el esquema completo de una base limpia.
- **El SQL Editor solo muestra el resultado de la última consulta:** los `-verificacion.sql` de una sola consulta se ejecutan completos, con "No limit".
- **Sin staging:** hay una sola base. **Respaldar antes** de aplicar migraciones destructivas (p. ej. la 07 elimina `id_insumo_okima` y `id_insumo_stock`/`qty_stock`); los roles se prueban con `2026-10-02-11-pruebas-roles.sql`, que no deja cambios.
- **TDD con vitest** para lógica pura de `src/lib/` (`npm test`): RED observado, GREEN, refactor. Para SQL, UI o estilos sin lógica nueva: `npm run lint`, `npm run build` y revisión del SQL contra `schema.sql`.
- **Los embebidos de PostgREST dependen de las FK:** al cambiar o quitar una FK hay que revisar toda consulta que embeba esa relación (el Resumen quedó roto tras quitar `id_insumo_okima`).
- Los scripts con la service-role key (`scripts/`) leen `.env.seed` y nunca se importan desde `src/`.

---

## Reglas de Trabajo para Claude

Para garantizar el éxito de este MVP, trabaja estrictamente bajo estas fases. **NO avances a la siguiente fase sin pedirme confirmación y que yo la apruebe.**

- **Fase 1: Inicialización y Base de Datos.**
  Crea el proyecto con Vite y genera un archivo `schema.sql` con todas las tablas, relaciones (Foreign Keys), la vista `vista_solicitudes_pendientes` y políticas RLS básicas de Supabase. Te pediré que te detengas para yo ejecutar ese SQL en mi panel de Supabase.
- **Fase 2: Configuración del Cliente Supabase.**
  Configurar variables de entorno y el archivo de conexión (`supabase.js`).
- **Fase 3: Layout y Enrutamiento.**
  Crea la estructura de navegación básica (Sidebar/Navbar) con React Router, con las 5 secciones de Funcionalidades Core.
- **Fase 4: Desarrollo de Pantallas.**
  Comenzaremos pantalla por pantalla. Primero los Mantenedores (Proveedores, Insumos, Centros de Costo: Categorías y Subcategorías), luego Solicitudes, Otros Gastos (hoy Boletas) y finalmente Facturación.
- **Fase 5: UI/UX y Exportación.**
  Refinamiento de estilos, lógica de impresión y botones de exportación CSV.

Por favor, lee este documento completo. Si lo entendiste, indícame los comandos iniciales para ejecutar la Fase 1.
