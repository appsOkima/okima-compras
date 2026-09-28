# Fase 4 — Desarrollo de Pantallas

Locator: `odd/tasks/fase-4-pantallas.md` · Engram mirror: `odd/fase-4-pantallas/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Construir las pantallas de las 5 secciones, en el orden de `CLAUDE.md`: primero los Mantenedores (Categorías/Subcategorías, Insumos Okima, Proveedores y su catálogo), luego Solicitudes, Otros Gastos y Facturación.

## Problema / por qué
Tras la Fase 3 cada sección muestra una página provisoria. El schema ya está ejecutado en Supabase (10 categorías, 34 subcategorías, 3 plantillas).

## Alcance autorizado
- Pantallas de la Fase 4 según `CLAUDE.md` y los skills `mantenedor-crud`, `creacion-al-vuelo`, `vista-impresion`.
- Componentes compartidos: tabla con exportación CSV (uno solo, reutilizado), formulario, filtros.
- Fuera de alcance: refinamiento visual fino y lógica de impresión definitiva (Fase 5); cambios de schema salvo que una pantalla lo exija (se consulta antes).

## Restricciones
- Pantalla por pantalla: tras los Mantenedores (T1–T4) se detiene para revisión del usuario antes de Solicitudes.
- Sin login; cliente único `src/lib/supabase.js`.
- Duplicados: chequeo de aplicación (normalizado sin mayúsculas/tildes/espacios), nunca UNIQUE en la base.
- `id_insumo_okima` se vincula solo en "Insumos por vincular" (Proveedores); vincular no aplica stock retroactivo.
- Montos en CLP.

## Decisiones de diseño (orquestador)
- Subsecciones como rutas anidadas: `/proveedores`, `/proveedores/catalogo`, `/proveedores/por-vincular`; `/centros-costo` (Categorías), `/centros-costo/subcategorias` (desde T4c; antes vivían bajo `/insumos`).
- CSV con separador `;` y BOM UTF-8 (Excel en configuración regional es-CL).
- "Incompletos" = campos que la creación al vuelo deja vacíos y que no son opcionales por naturaleza. Se excluyen dimensiones (no aplican a todos los insumos, ej. tóner) y campos opcionales (descripción, emails, etc.):
  - `insumos`: `codigo`, `venta_directa`, o `precio_venta` si `venta_directa = true`.
  - `proveedores`: `codigo`.
  - `insumos_proveedores`: `codigo`, `precio_clp`, `cantidad_formato`, `formato_unidad`.
  - `categorias`/`subcategorias`: sin filtro (no se crean al vuelo).
- Borrar un registro en uso (FK, código 23503) muestra un aviso y sugiere desactivarlo cuando la tabla tiene `activo`.

## Modo TDD
Off — fuente: sin configuración de proyecto/sesión ni pedido del usuario (igual que Fase 1). Runner: ninguno. Checks funcionales por tarea: `npx oxlint`, `npm run build`; funciones puras de `src/lib` verificadas con scripts node ad hoc; revisión visual del usuario en el checkpoint.

## RDD y entrega
`gentle-ai review mode status` → off (global). Entrega: `disabled/unmanaged`. Estrategia: `ask-on-risk` → usuario eligió **`stacked-to-main`** (2026-09-28). Skills `work-unit-commits` / `chained-pr`: no instalados en esta sesión; se aplica la estrategia a mano. Pronóstico: ~2.500 líneas autoradas.

Slices (rama apilada sobre la anterior, destino final `main`; la Fase 1–3 va antes en la pila):
- **S1** `feat/fase-4-mantenedor-base` — T1, T2.
- **S2** `feat/fase-4-insumos` — T3.
- **S3** `feat/fase-4-proveedores` — T4.
- **S3b** `feat/fase-4-ajustes-mantenedores` — T4b, T4c.
- **S4** `feat/fase-4-solicitudes` — T5. **S5** `feat/fase-4-gastos` — T6. **S6** `feat/fase-4-facturas` — T7.

## Tareas
- [x] **T1 — Base compartida de Mantenedores.** Ruta: delegado (writer trigger: 4+ archivos nuevos no triviales). `src/lib/texto.js` (normalizar, similares), `src/lib/csv.js`, `src/lib/formato.js` (CLP, fechas), hook `useTabla`, componentes `TablaDatos` (con botón CSV), `Mantenedor` (búsqueda, filtro Incompletos, Nuevo, formulario modal con aviso de duplicados, editar, borrar con manejo de FK), `Pestanas` para subsecciones. Aceptación: lint + build; funciones puras verificadas con node.
- [x] **T2 — Categorías y Subcategorías.** Ruta: delegado (junto a T1, mismo writer). Rutas `/insumos/categorias` y `/insumos/subcategorias`; subcategoría con selector de categoría, `descripcion`, `activo`. Aceptación: lint + build; CRUD visible en el navegador (checkpoint).
- [x] **T3 — Insumos Okima.** Ruta: delegado. `/insumos`: CRUD con `SelectorSubcategoria` (agrupado por categoría, solo activas), `venta_directa` habilita `precio_venta`, `qty` solo lectura, filtro Incompletos. Aceptación: lint + build.
- [x] **T4 — Proveedores, catálogo e Insumos por vincular.** Ruta: delegado. `/proveedores` (CRUD proveedores), `/proveedores/catalogo` (CRUD `insumos_proveedores`), `/proveedores/por-vincular` (asignar `id_insumo_okima` con selector buscable; aviso de que vincular no suma stock retroactivo). Aceptación: lint + build.
- [x] **Checkpoint** — usuario revisa Mantenedores en el navegador. Aprobado 2026-09-28 tras T4b/T4c ("Están bien los mantenedores").
- [x] **T4b — Tabla de Insumos más compacta + "Ver detalles".** Pedido del usuario en el checkpoint (2026-09-28). Ruta: delegado (writer trigger: `Mantenedor.jsx` + `Insumos.jsx`). La tabla de Insumos deja de mostrar descripción, dimensiones, categoría y venta directa; siguen en el CSV. Acción genérica "Ver detalles" en `Mantenedor` (prop `detalle`) con todos los campos. Aceptación: lint + build; CSV conserva todas las columnas.
- [x] **T4c — Panel propio "Centros de Costo".** Pedido del usuario (afecta también a Otros Gastos). Ruta: delegado (mismo writer). Nueva sección de menú `/centros-costo` con pestañas Categorías / Subcategorías; se quitan de Insumos Okima. Docs: `CLAUDE.md` (6 secciones; Funciones 5–6) e `historial-decisiones.md`. Aceptación: lint + build; rutas nuevas; `/insumos` sin pestañas de categorías.
- [x] **T5 — Solicitudes de Compra.** Ruta: delegado (writer trigger: página + Combobox con creación al vuelo + vista de impresión). `/solicitudes` con pestañas Pendientes (desde `vista_solicitudes_pendientes`, orden Alta→Media→Baja, colores por urgencia, botón Imprimir) y Todas (historial con filtro de estado). Crear/editar pendientes, Cancelar (Comprada solo por trigger). `insumo_okima` con `Combobox` + `onCrear` (nombre + subcategoría, aviso de similares). Solicitante: texto con autocompletado de solicitantes anteriores (sin tabla de empleados; recordado en localStorage). Aceptación: lint + build; aserciones node de funciones puras; revisión del usuario.
- [ ] **T6 — Otros Gastos.** Ruta: delegado (writer trigger: 2 páginas + ingreso rápido + extensiones de Mantenedor). `/gastos` con pestañas Gastos y Plantillas. Gastos: CRUD de `otros_gastos` (orden fecha desc, filtro por mes, total de lo visible, "Incompletos" = sin subcategoría, proveedor opcional con Combobox sin creación). Ingreso rápido desde plantillas activas: pre-llena concepto, subcategoría y monto; fecha hoy editable; guarda `id_plantilla_recurrente`; avisa si esa plantilla ya tiene gasto en el mismo mes. Plantillas: CRUD de `plantillas_gastos_recurrentes` (monto_default, activo). Aceptación: lint + build + aserciones node; revisión del usuario.
- [ ] **T7 — Facturas.** (pendiente)

## Progreso / evidencia
- Prerrequisito: commit `dfc2a96` elimina `.env.example` (pedido del usuario) en `feat/fase-3-layout`.
- **T1** — commit `9b48265` (S1). Writer delegado; orquestador revisó `useTabla` y `Mantenedor`. `npx oxlint` exit 0; `npm run build` OK (aviso de chunk > 500 kB por el cliente Supabase, a optimizar en Fase 5 con code-splitting); 26/26 aserciones node sobre `src/lib` (normalizar, coincide, buscarSimilares, CSV, formatos, mensajeError). Desviaciones aceptadas: props `filtroDuplicados`, `etiquetaDuplicado`, `booleano.anulable`, campos ocultos se guardan null, textos con trim. No verificado: CRUD real contra Supabase (checkpoint). RDD: disabled/unmanaged.
- **T2** — commit `ae37b88` (S1). Rutas anidadas bajo `/insumos`; duplicados de subcategoría solo dentro de la misma categoría. Mismos checks que T1. RDD: disabled/unmanaged.
- **T3** — commit `0a3d224` (S2 `feat/fase-4-insumos`). Writer delegado. `qty` nunca se envía (no es campo del formulario). Extensión de la base: columnas `soloCsv`/`soloTabla` en TablaDatos; CSV exporta decimales con coma (Excel es-CL leía 1.5 como 15). oxlint 0 diagnósticos; build OK; 12/12 aserciones node. RDD: disabled/unmanaged.
- **T4** — commit `447d2a7` (S3 `feat/fase-4-proveedores`). `SeccionConPestanas` genérico (Insumos y Proveedores); aviso de RUT duplicado normalizado; Catálogo sin edición de `id_insumo_okima`; Por vincular con `Combobox` buscable (preparado para `onCrear`), filtra en el navegador. oxlint 0; build OK; 13/13 aserciones node. RDD: disabled/unmanaged.
- **T4b** — commit `f5d4a2f` (S3b `feat/fase-4-ajustes-mantenedores`). Writer delegado. Archivos: `src/components/DetalleRegistro.jsx` (nuevo, ficha genérica con Editar/Cerrar; ítems con `completo` ocupan el ancho), `Mantenedor.jsx` (prop `detalle`, botón Eye "Ver detalles"; guarda el id para mostrar datos recargados), `lib/formato.js` (`formatoFechaLocal`: `created_at` UTC → fecha local), `pages/insumos/Insumos.jsx` (tabla: nombre, código, subcategoría, precio venta, stock; CSV conserva categoría, ancho/alto/profundidad, venta directa y descripción vía `soloCsv`). oxlint 0 diagnósticos; build OK (mismo aviso de chunk > 500 kB); 7/7 aserciones node sobre `formatoFechaLocal`. RDD: disabled/unmanaged.
- **T4c** — commit `2c0614b` (S3b). Writer delegado. Sección `/centros-costo` (ícono FolderTree, última del menú) con pestañas Categorías (index) / Subcategorías; `Categorias.jsx` y `Subcategorias.jsx` movidos con `git mv` a `src/pages/centros-costo/` + `SeccionCentrosCosto.jsx`; `/insumos` usa `SeccionConPestanas` sin pestañas (prop opcional) y se elimina `SeccionInsumos.jsx`. Docs: `CLAUDE.md` (6 secciones, Función 6, Fase 4), `historial-decisiones.md` (2 viñetas del 2026-09-28), skill `mantenedor-crud`. oxlint 0 diagnósticos (32 archivos); build OK. Sin referencias a `/insumos/categorias` en `src/`. Nota: la decisión de diseño "Subsecciones como rutas anidadas" de arriba queda superada para categorías/subcategorías (ahora bajo `/centros-costo`). RDD: disabled/unmanaged.
- Usuario aprobó la vista de impresión de Solicitudes y realizó pruebas menores (2026-09-28).
- **T5** — commit `19ec510` (S4 `feat/fase-4-solicitudes`). Writer delegado. Nuevos: `src/lib/solicitudes.js` (metadatos de urgencia/estado, `hoyISO`, `estadoFechaTope`/`estaVencida`, `compararPendientes`, `solicitantesUnicos`, último solicitante en localStorage con try/catch), `src/lib/opciones.js` (`filtrarOpciones`, lógica pura del Combobox con propuesta de creación), `components/EtiquetaUrgencia.jsx`, `pages/solicitudes/` (`SeccionSolicitudes`, `Pendientes`, `Todas`, `FormularioSolicitud`, `SelectorInsumo` con mini-formulario inline nombre + subcategoría y "Usar este" sobre parecidos). Extensiones genéricas compatibles: `Combobox` prop `onCrear`; `FormularioRegistro` `validar` y `sugerencias` (datalist); `TablaDatos` `claseFila` y columna `noImprimir` + clase `tabla-datos`; `useTabla` `recargar({ silencioso })`; `Layout` y `SeccionConPestanas` sin padding/encabezado al imprimir; `index.css` reglas `@media print` (bordes, encabezado repetido, filas sin cortar). Pendientes se consulta por `created_at` y se reordena en el navegador con `compararPendientes` (mismo orden que la vista, la API no garantiza el ORDER BY). oxlint 0 diagnósticos (40 archivos); build OK (mismo aviso de chunk > 500 kB); 32/32 aserciones node (`solicitudes.js`, `opciones.js`). ~1.150 líneas autoradas (sobre el heurístico: la tarea especifica dos pantallas, formulario, creación al vuelo e impresión como una unidad). No verificado: CRUD real contra Supabase, creación al vuelo real, impresión real en papel/PDF. RDD: disabled/unmanaged.
- Líneas autoradas S2: ~170; S3: ~660; S3b: ~215 (T4b ~135, T4c ~80 incl. docs).
- Líneas autoradas S1: ~1.300 (sobre el heurístico: la base compartida es una unidad coherente que usan todos los mantenedores).

## Siguiente paso
Revisión del usuario de T5 en el navegador (crear/editar/cancelar/reactivar, creación al vuelo de insumo, vista previa de impresión). Luego T6 Otros Gastos en `feat/fase-4-gastos`.
