# Contexto del Proyecto: Sistema de Compras y Recepción "Okima"

*Guarda este archivo como `CLAUDE.md` en la raíz de tu repo cuando trabajes en Claude Code / VS Code — así lo carga automáticamente en cada sesión nueva.*

## Decisiones clave

Resumen operativo — el detalle y el razonamiento de cada punto está en `historial-decisiones.md`, aparte para no cargar cada sesión con la trazabilidad completa.

- Sin login; RLS permisivo.
- Todo en CLP, sin excepciones.
- Creación al vuelo para `insumo_okima`, `proveedor` e `insumo_proveedor` (ver sección dedicada) — varios campos quedan nullable.
- `insumos.qty` se actualiza solo al guardar una línea de factura.
- Vínculo `insumo_proveedor` → `insumo_okima`: no se hace al ingresar la factura; solo lo hace el administrador, en su revisión semanal.
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

- **Solicitudes de Compra → `insumo_okima`:** captura `nombre` + `id_categoria` (ambos obligatorios). El resto queda nulo.
- **Gestionar Facturas → `proveedor`:** primero `nombre` (para verificar si ya estaba ingresado), luego `rut` (obligatorio). El resto queda nulo.
- **Gestionar Facturas → `insumo_proveedor`:** captura `nombre` y hereda `id_proveedor` del proveedor ya seleccionado en esa factura. `id_insumo_okima` **no se pide aquí** — queda vacío siempre; solo el administrador lo vincula, en su revisión semanal (ver Función 4).

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
- `id_categoria` (uuid, FK a categorias) — obligatorio siempre, incluso al crear al vuelo
- `codigo` (text, nullable)
- `ancho`, `alto`, `profundidad` (numeric, nullable) - En milímetros
- `venta_directa` (boolean, nullable) - indica si el insumo también se vende directamente tal como está (ej. scotch, resmas de papel)
- `precio_venta` (numeric, nullable) - precio de venta directa; aplica cuando `venta_directa = true`
- `qty` (integer) - Default 0. Se actualiza automáticamente al ingresar facturas.
- `descripcion` (text, opcional)

*(`codigo`, `ancho`, `alto`, `profundidad`, `venta_directa` y `precio_venta` pasan a nullable por la creación al vuelo)*

### 3. insumos_proveedores (Catálogo)
- `id` (uuid, PK)
- `id_insumo_okima` (uuid, FK a insumos, nullable) — nunca se llena al crear el `insumo_proveedor`; solo el administrador lo vincula desde el Mantenedor, en su revisión semanal (ver Función 4)
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
- `neto_total`, `descuento_total`, `iva`, `total` (numeric) - en CLP, incluidas las facturas de Google Workspace (monto ya convertido antes de ingresarlo); se ingresan tal cual figuran en la factura física; conviene que la interfaz avise si no cuadran con la suma de `detalle_facturas`

### 6. detalle_facturas (Líneas)
- `id` (uuid, PK)
- `id_factura` (uuid, FK a facturas)
- `id_insumo_proveedor` (uuid, FK a insumos_proveedores)
- `id_solicitud_compra` (uuid, FK a solicitudes_compra, opcional) - Enlaza con la solicitud que originó la compra.
- `cantidad`, `precio_neto`, `descuento`, `subtotal` (numeric)

### 7. otros_gastos
Gastos que no corresponden a la compra de un insumo con stock (ej. arriendo, sueldos, pago de IVA, servicios).
- `id` (uuid, PK)
- `concepto` (text)
- `id_categoria` (uuid, FK a categorias, opcional)
- `id_plantilla_recurrente` (uuid, FK a plantillas_gastos_recurrentes, opcional) - si el gasto se originó desde un atajo de gasto recurrente, queda la referencia a cuál
- `id_proveedor` (uuid, FK a proveedores, opcional)
- `monto` (numeric) - en CLP
- `fecha` (date)
- `numero_documento` (text, opcional)
- `notas` (text, opcional)

### 8. categorias
- `id` (uuid, PK)
- `nombre` (text)
- `activo` (boolean, default true) - para retirar categorías del dropdown sin borrar el historial que ya las usa

*Cuando tengas la lista inicial de categorías, la incluimos como datos semilla (`INSERT`) en el `schema.sql` de la Fase 1.*

### 9. plantillas_gastos_recurrentes — **[NUEVO]**
Tipos de gasto recurrente (Arriendo, Sueldos, Pago IVA) y su monto habitual, editable.
- `id` (uuid, PK)
- `nombre` (text) - ej: "Arriendo", "Sueldos", "Pago IVA"
- `id_categoria` (uuid, FK a categorias, opcional)
- `monto_default` (numeric) - editable; pre-llena el monto al registrar ese gasto
- `activo` (boolean, default true) - para retirar un tipo sin borrar el historial de gastos ya asociados

## Vistas sugeridas para la Fase 1

- **`vista_solicitudes_pendientes`**: `solicitudes_compra` con `estado = 'Pendiente'`, ordenada por `nivel_urgencia` (Alta → Media → Baja), con el nombre del `insumo_okima`, su `fecha_esperada` y los proveedores sugeridos — los `proveedores.nombre` de los `insumos_proveedores` cuyo `id_insumo_okima` coincide con el de la solicitud. Alimenta la lista y la impresión de la Función 1.

---

## Funcionalidades Core a Desarrollar

Sin login: las 5 secciones quedan disponibles directamente y cada empleado se capacita en la que usa.

1. **Solicitudes de Compra**
   - Crear y ver `solicitudes_compra`; selección de `insumo_okima` con creación al vuelo.
   - Alertas visuales por color según `nivel_urgencia`.
   - Lista y vista de impresión basadas en `vista_solicitudes_pendientes`: solo 'Pendiente', ordenada por urgencia, mostrando insumo, fecha tope y proveedores sugeridos. Botón de impresión (`@media print` para ocultar menús).
2. **Gestionar Facturas**
   - Maestro-detalle: se crea la factura y se agregan dinámicamente las líneas; selección de `proveedor` (nombre, luego rut si es nuevo) e `insumo_proveedor` con creación al vuelo.
   - **Regla de negocio:** línea con `id_solicitud_compra` → esa solicitud pasa a 'Comprada'.
   - **Regla de negocio:** línea cuyo `insumo_proveedor` tiene `id_insumo_okima` vinculado → `insumos.qty += cantidad × cantidad_formato`. Si no está vinculado, no se actualiza stock hasta que se vincule.
3. **Otros Gastos**
   - CRUD de `otros_gastos`.
   - CRUD de `plantillas_gastos_recurrentes`: pantalla simple donde el administrador mantiene Arriendo/Sueldos/IVA y edita el `monto_default` cuando cambie.
   - Ingreso rápido de gasto recurrente: se elige una plantilla y se pre-llenan `concepto`, `id_categoria` y `monto` desde ella. Solo queda por confirmar la `fecha` (default: hoy, editable a una fecha pasada).
4. **Gestionar Proveedores y sus Insumos**
   - CRUD de `proveedores` e `insumos_proveedores`.
   - Vista de "insumos por vincular": `insumos_proveedores` con `id_insumo_okima` vacío, con selector directo para asignarlo — es el único lugar donde se hace este vínculo, pensado para la revisión semanal del administrador.
   - Filtro de registros incompletos (creados al vuelo).
5. **Gestionar Insumos Okima**
   - CRUD de `insumos` (incluye gestión de `categorias`).
   - Filtro de registros incompletos creados al vuelo.

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
  Comenzaremos pantalla por pantalla. Primero los Mantenedores (Proveedores, Insumos, Categorías), luego Solicitudes, Otros Gastos y finalmente Facturación.
- **Fase 5: UI/UX y Exportación.**
  Refinamiento de estilos, lógica de impresión y botones de exportación CSV.

Por favor, lee este documento completo. Si lo entendiste, indícame los comandos iniciales para ejecutar la Fase 1.
