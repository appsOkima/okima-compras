# Contexto del Proyecto: Sistema de Compras y Recepción "Okima"

*Guarda este archivo como `CLAUDE.md` en la raíz de tu repo cuando trabajes en Claude Code / VS Code — así lo carga automáticamente en cada sesión nueva.*

## Decisiones clave

Resumen operativo — el detalle y el razonamiento de cada punto está en `historial-decisiones.md`, aparte para no cargar cada sesión con la trazabilidad completa.

- Sin login; RLS permisivo.
- Todo en CLP, sin excepciones.
- Creación al vuelo para `insumo_okima`, `proveedor` e `insumo_proveedor` (ver sección dedicada) — varios campos quedan nullable.
- `insumos.qty` (numeric, acepta decimales) se actualiza solo al guardar una línea de factura cuyo `insumo_proveedor` ya esté vinculado; vincular después no aplica stock retroactivo.
- Reglas de negocio de facturas (stock y solicitud 'Comprada') implementadas como triggers en la base.
- `categorias` = centros de costo, con `subcategorias`; `insumos`, `otros_gastos` y `plantillas_gastos_recurrentes` referencian solo `id_subcategoria` (la categoría se obtiene a través de ella).
- Vínculo `insumo_proveedor` → `insumo_okima`: nunca al crear el `insumo_proveedor` al vuelo ni en silencio. Lo hace el administrador en su revisión semanal ("Por vincular") o, en Facturas, al asociar una línea a una solicitud, solo con confirmación explícita del usuario.
- Gasto recurrente vía `plantillas_gastos_recurrentes` (monto editable), no un valor fijo.
- `venta_directa` en `insumos` habilita `precio_venta`.

No quedan puntos pendientes de tu parte — el documento está listo para la Fase 1.

---

## Objetivo del Proyecto
Desarrollar un MVP (App Web) para gestionar solicitudes de compra de insumos y registrar facturas de proveedores. La prioridad es una excelente experiencia de usuario (carga rápida, interfaces intuitivas) y la correcta recolección/relación de datos para exportarlos a un futuro ERP en 6 meses.

## Stack Tecnológico Requerido
- **Frontend:** React (usando Vite), Tailwind CSS para estilos rápidos.
- **Iconos y Componentes:** `lucide-react` para iconos. Componentes limpios y funcionales (tipo shadcn/ui o Tailwind puro).
- **Backend y Base de Datos:** Supabase (PostgreSQL) usando `@supabase/supabase-js`.
- **Navegación:** `react-router-dom`.
- **Autenticación:** ninguna por ahora.

---

## Creación al vuelo (autocompletar + crear)

Patrón de UX para tres entidades: el input es un combobox con autocompletado sobre los registros existentes; si el texto escrito no calza con ninguno, permite crear un registro nuevo con ese texto como `nombre` (más los campos adicionales obligatorios de cada caso). El resto de los campos queda vacío y se completa después en el Mantenedor correspondiente.

- **Solicitudes de Compra → `insumo_okima`:** captura `nombre` + `id_subcategoria` (ambos obligatorios). El resto queda nulo.
- **Gestionar Facturas → `proveedor`:** primero `nombre` (para verificar si ya estaba ingresado), luego `rut` (obligatorio). El resto queda nulo.
- **Gestionar Facturas → `insumo_proveedor`:** captura `nombre` y hereda `id_proveedor` del proveedor ya seleccionado en esa factura. `id_insumo_okima` **no se pide aquí** — queda vacío siempre al crearlo; se vincula después: el administrador en su revisión semanal (ver Función 4) o, con confirmación explícita, al asociar la línea de factura a una solicitud (ver Función 2).

**Duplicados:** antes de ofrecer "crear nuevo", el autocompletado debería buscar coincidencias sin distinguir mayúsculas/tildes/espacios y avisar si hay algo parecido, en vez de crear silenciosamente un registro repetido. Esto es un chequeo de aplicación, no un `UNIQUE` en la base.

Consecuencia: en los Mantenedores conviene un filtro tipo "incompletos" que muestre los registros creados al vuelo a los que les falten datos, para que no queden olvidados.

---

## Modelo de Datos (Esquema Relacional)

Para Supabase, todas las tablas deben usar `id` (UUID o gen_random_uuid() como Primary Key) e incluir `created_at` (timestamp).

### 1. proveedores
- `id` (uuid, PK)
- `nombre` (text)
- `codigo` (text, nullable) - Ej: ID + Nombre abreviado
- `rut` (text) - obligatorio siempre, incluso al crear al vuelo (se necesita para ingresar facturas)
- `direccion_1`, `direccion_2` (text, opcionales)
- `email_1`, `email_2` (text, opcionales)
- `fono_1`, `fono_2` (text, opcionales)
- `datos_transferencia` (text, opcional)
- `notas` (text, opcional)

*(solo `codigo` pasa a nullable por la creación al vuelo — `rut` se mantiene obligatorio)*

### 2. insumos (Insumos internos de Okima)
- `id` (uuid, PK)
- `nombre` (text)
- `id_subcategoria` (uuid, FK a subcategorias) — obligatorio siempre, incluso al crear al vuelo; la categoría (centro de costo) se obtiene a través de la subcategoría
- `codigo` (text, nullable)
- `ancho`, `alto`, `profundidad` (numeric, nullable) - En milímetros
- `venta_directa` (boolean, nullable) - indica si el insumo también se vende directamente tal como está (ej. scotch, resmas de papel)
- `precio_venta` (numeric, nullable) - precio de venta directa; aplica cuando `venta_directa = true`
- `qty` (numeric, acepta decimales) - Default 0. Se actualiza automáticamente al ingresar facturas (trigger de stock, ver Función 2).
- `descripcion` (text, opcional)

*(`codigo`, `ancho`, `alto`, `profundidad`, `venta_directa` y `precio_venta` pasan a nullable por la creación al vuelo)*

### 3. insumos_proveedores (Catálogo)
- `id` (uuid, PK)
- `id_insumo_okima` (uuid, FK a insumos, nullable) — nunca se llena al crear el `insumo_proveedor`; lo vincula el administrador desde el Mantenedor, en su revisión semanal (ver Función 4), o el usuario desde Facturas, con confirmación explícita, al asociar una línea a una solicitud (ver Función 2)
- `nombre` (text)
- `codigo` (text, nullable)
- `id_proveedor` (uuid, FK a proveedores)
- `precio_clp` (numeric, nullable)
- `ancho`, `alto`, `profundidad` (numeric, nullable) — *confirmar si todos los proveedores cotizan en milímetros*
- `cantidad_formato` (numeric, nullable) - unidades internas que trae cada formato de compra
- `formato_unidad` (text, nullable) - renombrado desde `formato_qty`
- `fecha_actualizacion` (date, nullable)
- `link_insumo` (text, opcional)
- `descripcion` (text, opcional)

*(`codigo`, `precio_clp`, dimensiones, `cantidad_formato`, `formato_unidad` y `fecha_actualizacion` pasan a nullable por la creación al vuelo)*

### 4. solicitudes_compra
- `id` (uuid, PK)
- `solicitante` (text) - sin login, texto libre; considerar selector con lista de empleados en la interfaz para evitar variaciones de escritura
- `id_insumo_okima` (uuid, FK a insumos)
- `cantidad_solicitada` (numeric)
- `nivel_urgencia` (ENUM: 'Baja', 'Media', 'Alta', en ese orden) - permite ordenar correctamente en la vista de impresión (ver Función 1); un `text` plano ordenaría mal alfabéticamente
- `fecha_esperada` (date, opcional) - fecha tope del pedido; se muestra en la vista de impresión
- `estado` (text) - Valores: 'Pendiente', 'Comprada', 'Cancelada'. Default: 'Pendiente'

### 5. facturas (Cabecera)
- `id` (uuid, PK)
- `id_proveedor` (uuid, FK a proveedores)
- `numero_factura` (text) — `UNIQUE (id_proveedor, numero_factura)`
- `fecha` (date)
- `descuento_pct` (numeric, % 0–100, default 0) - descuento global de la factura, en porcentaje; es lo único de los totales que ingresa el usuario, si aplica
- `neto_total`, `iva`, `total` (numeric) - en CLP, incluidas las facturas de Google Workspace (monto ya convertido antes de ingresarlo); no se ingresan: los calcula la interfaz desde las líneas y se guardan ya calculados — neto = Σ subtotales × (1 − `descuento_pct`/100), IVA = 19 % del neto, total = neto + IVA (redondeados al peso)

### 6. detalle_facturas (Líneas)
- `id` (uuid, PK)
- `id_factura` (uuid, FK a facturas)
- `id_insumo_proveedor` (uuid, FK a insumos_proveedores)
- `id_solicitud_compra` (uuid, FK a solicitudes_compra, opcional) - Enlaza con la solicitud que originó la compra.
- `cantidad`, `precio_neto` (numeric)
- `descuento_pct` (numeric, % 0–100, default 0) - descuento de la línea, en porcentaje
- `subtotal` (numeric) - no se ingresa: lo calcula la interfaz, cantidad × precio_neto × (1 − `descuento_pct`/100), redondeado al peso
- `id_insumo_stock` (uuid, FK a insumos, nullable) y `qty_stock` (numeric, nullable) - stock aplicado al guardar la línea; los llena el trigger, no la interfaz. Permiten revertir exactamente lo sumado si la línea se edita o se borra (incluido el borrado en cascada de la factura)

### 7. otros_gastos
Gastos que no corresponden a la compra de un insumo con stock (ej. arriendo, sueldos, pago de IVA, servicios).
- `id` (uuid, PK)
- `concepto` (text)
- `id_subcategoria` (uuid, FK a subcategorias, opcional)
- `id_plantilla_recurrente` (uuid, FK a plantillas_gastos_recurrentes, opcional) - si el gasto se originó desde un atajo de gasto recurrente, queda la referencia a cuál
- `id_proveedor` (uuid, FK a proveedores, opcional)
- `monto` (numeric) - en CLP
- `fecha` (date)
- `numero_documento` (text, opcional)
- `notas` (text, opcional)

### 8. categorias (Centros de costo)
Cada categoría es un centro de costo; se desglosa en `subcategorias` (ver sección 10).
- `id` (uuid, PK)
- `nombre` (text)
- `activo` (boolean, default true) - para retirar categorías del dropdown sin borrar el historial que ya las usa

*Datos semilla en `schema.sql`, desde `centros_de_costo.csv`: 10 categorías y 34 subcategorías.*

### 9. plantillas_gastos_recurrentes — **[NUEVO]**
Tipos de gasto recurrente (Arriendo, Sueldos, Pago IVA) y su monto habitual, editable.
- `id` (uuid, PK)
- `nombre` (text) - ej: "Arriendo", "Sueldos", "Pago IVA"
- `id_subcategoria` (uuid, FK a subcategorias, opcional)
- `monto_default` (numeric) - editable; pre-llena el monto al registrar ese gasto
- `activo` (boolean, default true) - para retirar un tipo sin borrar el historial de gastos ya asociados

*Datos semilla (todas bajo GASTOS ADMINISTRATIVOS Y FIJOS, `monto_default` 0): Arriendo → Infraestructura, Sueldos → Remuneraciones, Pago IVA → Impuestos y Finanzas.*

### 10. subcategorias
Desglose de cada categoría (centro de costo). Es lo que referencian `insumos`, `otros_gastos` y `plantillas_gastos_recurrentes`: solo la subcategoría, para no guardar pares categoría/subcategoría inconsistentes.
- `id` (uuid, PK)
- `id_categoria` (uuid, FK a categorias) — obligatorio
- `nombre` (text)
- `descripcion` (text, opcional) - ítems incluidos (columna "Items Incluidos" de `centros_de_costo.csv`), ej: "Papeles, Toner (solo negro)"
- `activo` (boolean, default true) - para retirar subcategorías del dropdown sin borrar el historial que ya las usa

## Vistas sugeridas para la Fase 1

- **`vista_solicitudes_pendientes`**: `solicitudes_compra` con `estado = 'Pendiente'`, ordenada por `nivel_urgencia` (Alta → Media → Baja), con el nombre del `insumo_okima`, su `fecha_esperada` y los proveedores sugeridos — los `proveedores.nombre` de los `insumos_proveedores` cuyo `id_insumo_okima` coincide con el de la solicitud. Alimenta la lista y la impresión de la Función 1.

---

## Funcionalidades Core a Desarrollar

Sin login: las 6 secciones quedan disponibles directamente y cada empleado se capacita en la que usa.

1. **Solicitudes de Compra**
   - Crear y ver `solicitudes_compra`; selección de `insumo_okima` con creación al vuelo.
   - Alertas visuales por color según `nivel_urgencia`.
   - Lista y vista de impresión basadas en `vista_solicitudes_pendientes`: solo 'Pendiente', ordenada por urgencia, mostrando insumo, fecha tope y proveedores sugeridos. Botón de impresión (`@media print` para ocultar menús).
2. **Gestionar Facturas**
   - Maestro-detalle: se crea la factura y se agregan dinámicamente las líneas; selección de `proveedor` (nombre, luego rut si es nuevo) e `insumo_proveedor` con creación al vuelo.
   - Montos calculados: el usuario ingresa cantidad y precio neto de cada línea y, si aplica, el descuento en % (por línea y global de la factura). Subtotal, neto, IVA (19 %) y total solo se calculan y se muestran; no son editables.
   - **Regla de negocio (trigger en la base):** línea con `id_solicitud_compra` (al insertarla o al asociarla después) → esa solicitud pasa a 'Comprada'.
   - **Regla de negocio (trigger en la base):** si al guardar la línea su `insumo_proveedor` ya tiene `id_insumo_okima` vinculado → `insumos.qty += cantidad × cantidad_formato` (`cantidad_formato` vacío cuenta como 1). Si no está vinculado, no se registra stock, y vincularlo después no lo aplica retroactivamente. Lo aplicado queda en `detalle_facturas.id_insumo_stock` / `qty_stock`, así que editar o borrar la línea (o la factura completa) revierte exactamente lo sumado.
   - **Vínculo desde la solicitud, con confirmación:** si una línea tiene solicitud y su `insumo_proveedor` no está vinculado, la interfaz pregunta en la línea si vincularlo con el `insumo_okima` de la solicitud ("Vincular" / "No vincular", cambiable hasta guardar). Nunca en silencio ni al crear el insumo al vuelo. Lo aceptado se aplica al guardar, antes de las líneas (solo si sigue sin vincular), así la línea nueva ya suma stock; una línea ya guardada no suma stock retroactivo. Si ya está vinculado a otro insumo, solo se avisa: aquí no se re-vincula.
3. **Otros Gastos**
   - CRUD de `otros_gastos`.
   - CRUD de `plantillas_gastos_recurrentes`: pantalla simple donde el administrador mantiene Arriendo/Sueldos/IVA y edita el `monto_default` cuando cambie.
   - Ingreso rápido de gasto recurrente: se elige una plantilla y se pre-llenan `concepto`, `id_subcategoria` y `monto` desde ella. Solo queda por confirmar la `fecha` (default: hoy, editable a una fecha pasada).
4. **Gestionar Proveedores y sus Insumos**
   - CRUD de `proveedores` e `insumos_proveedores`.
   - Vista de "insumos por vincular": `insumos_proveedores` con `id_insumo_okima` vacío, con selector directo para asignarlo — es el lugar principal de este vínculo, pensado para la revisión semanal del administrador (también se puede vincular desde Facturas, con confirmación, al asociar una línea a una solicitud; ver Función 2).
   - Filtro de registros incompletos (creados al vuelo).
5. **Gestionar Insumos Okima**
   - CRUD de `insumos`.
   - Filtro de registros incompletos creados al vuelo.
6. **Centros de Costo**
   - CRUD de `categorias` (centros de costo) y `subcategorias`. Sección propia, no dentro de Insumos Okima: las subcategorías las usan `insumos`, `otros_gastos` y `plantillas_gastos_recurrentes`.

Transversal: botón reutilizable de exportación a CSV en todas las vistas de tabla.

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
  Comenzaremos pantalla por pantalla. Primero los Mantenedores (Proveedores, Insumos, Centros de Costo: Categorías y Subcategorías), luego Solicitudes, Otros Gastos y finalmente Facturación.
- **Fase 5: UI/UX y Exportación.**
  Refinamiento de estilos, lógica de impresión y botones de exportación CSV.

Por favor, lee este documento completo. Si lo entendiste, indícame los comandos iniciales para ejecutar la Fase 1.
