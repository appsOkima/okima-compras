# Historial de Decisiones — Sistema Okima

Detalle completo de las decisiones tomadas durante el diseño del MVP, con el razonamiento detrás de cada una. El resumen operativo vive en `CLAUDE.md`; este archivo es la referencia de "por qué se hizo así" — consúltalo cuando haga falta el contexto completo, no en cada sesión.

**Decisiones ya tomadas:**
- **[FIX]** `id_insumo_okima` agregado como FK en `insumos_proveedores`.
- **[FIX]** `UNIQUE (id_proveedor, numero_factura)` en `facturas`.
- **[FIX]** `formato_qty` → `formato_unidad`.
- Sin login; RLS permisivo (no por rol).
- `insumos.qty` se actualiza solo al guardar una línea de factura: `cantidad × cantidad_formato`.
- Creación al vuelo para `insumo_okima`, `proveedor` e `insumo_proveedor` (ver sección dedicada en `CLAUDE.md`) — varios campos de esas tablas quedan nullable.
- Tabla `categorias` compartida entre `insumos` y `otros_gastos`; obligatoria en `insumos`, incluso al crear al vuelo.
- Vínculo `insumo_proveedor` → `insumo_okima`: en un principio se permitía completarlo al vuelo al crear la factura; se revirtió — no se hace ahí. Solo el administrador lo vincula desde el Mantenedor, en su revisión semanal. El filtro de "incompletos" en los Mantenedores sirve para esto y para cualquier otro dato dejado en blanco por la creación al vuelo.
- Todo en CLP, sin excepciones; Google es un `proveedor` normal, factura por el flujo normal con el monto ya convertido.
- **Proveedor al vuelo:** captura `nombre` primero (para buscar si ya existe) y `rut` (obligatorio siempre, incluso al vuelo — se necesita para ingresar facturas). El resto sigue quedando nulo.
- `insumo_directo` → renombrado `venta_directa`: marca insumos que también se venden directamente tal como están (ej. scotch, resmas de papel).
- `insumos` gana `precio_venta` (nullable): aplica cuando `venta_directa = true`, es el precio al que Okima vende ese insumo directamente.
- `familia` eliminado de `insumos`: era para lo mismo que `id_categoria`, quedaba redundante.
- `precio_dolar` eliminado de `insumos_proveedores` (ya no aplica, todo en CLP).
- `nivel_urgencia` se modela como `ENUM` de Postgres (Alta/Media/Baja, en ese orden) para poder ordenar correctamente.
- "Fecha de máximo tope" = `fecha_esperada` (confirmado).
- Gasto recurrente: se maneja con una tabla `plantillas_gastos_recurrentes` — Arriendo/Sueldos/IVA, cada una con su `monto_default` editable por el administrador. Al registrar el gasto se elige la plantilla y se pre-llenan concepto, categoría y monto; solo la fecha queda por completar (default hoy, editable a una fecha pasada). El campo `es_recurrente` (booleano) se reemplazó por `id_plantilla_recurrente` en `otros_gastos`, que ya indica por sí solo si el gasto es recurrente y de cuál tipo.

No quedan puntos pendientes. Una nota a futuro, no bloqueante: ahora que Okima vende ciertos insumos directamente (`venta_directa` + `precio_venta`), en algún momento probablemente haga falta registrar esas ventas (ingresos) — no es parte de este MVP, pero queda anotado para cuando definamos el alcance del ERP.
