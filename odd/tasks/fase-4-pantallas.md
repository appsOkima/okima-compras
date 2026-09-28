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
- Subsecciones como rutas anidadas: `/insumos`, `/insumos/categorias`, `/insumos/subcategorias`; `/proveedores`, `/proveedores/catalogo`, `/proveedores/por-vincular`.
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
- **S4** `feat/fase-4-solicitudes` — T5. **S5** `feat/fase-4-gastos` — T6. **S6** `feat/fase-4-facturas` — T7.

## Tareas
- [x] **T1 — Base compartida de Mantenedores.** Ruta: delegado (writer trigger: 4+ archivos nuevos no triviales). `src/lib/texto.js` (normalizar, similares), `src/lib/csv.js`, `src/lib/formato.js` (CLP, fechas), hook `useTabla`, componentes `TablaDatos` (con botón CSV), `Mantenedor` (búsqueda, filtro Incompletos, Nuevo, formulario modal con aviso de duplicados, editar, borrar con manejo de FK), `Pestanas` para subsecciones. Aceptación: lint + build; funciones puras verificadas con node.
- [x] **T2 — Categorías y Subcategorías.** Ruta: delegado (junto a T1, mismo writer). Rutas `/insumos/categorias` y `/insumos/subcategorias`; subcategoría con selector de categoría, `descripcion`, `activo`. Aceptación: lint + build; CRUD visible en el navegador (checkpoint).
- [ ] **T3 — Insumos Okima.** Ruta: delegado. `/insumos`: CRUD con `SelectorSubcategoria` (agrupado por categoría, solo activas), `venta_directa` habilita `precio_venta`, `qty` solo lectura, filtro Incompletos. Aceptación: lint + build.
- [ ] **T4 — Proveedores, catálogo e Insumos por vincular.** Ruta: delegado. `/proveedores` (CRUD proveedores), `/proveedores/catalogo` (CRUD `insumos_proveedores`), `/proveedores/por-vincular` (asignar `id_insumo_okima` con selector buscable; aviso de que vincular no suma stock retroactivo). Aceptación: lint + build.
- [ ] **Checkpoint** — usuario revisa Mantenedores en el navegador.
- [ ] **T5 — Solicitudes de Compra.** (pendiente de checkpoint)
- [ ] **T6 — Otros Gastos.** (pendiente)
- [ ] **T7 — Facturas.** (pendiente)

## Progreso / evidencia
- Prerrequisito: commit `dfc2a96` elimina `.env.example` (pedido del usuario) en `feat/fase-3-layout`.
- **T1** — commit `9b48265` (S1). Writer delegado; orquestador revisó `useTabla` y `Mantenedor`. `npx oxlint` exit 0; `npm run build` OK (aviso de chunk > 500 kB por el cliente Supabase, a optimizar en Fase 5 con code-splitting); 26/26 aserciones node sobre `src/lib` (normalizar, coincide, buscarSimilares, CSV, formatos, mensajeError). Desviaciones aceptadas: props `filtroDuplicados`, `etiquetaDuplicado`, `booleano.anulable`, campos ocultos se guardan null, textos con trim. No verificado: CRUD real contra Supabase (checkpoint). RDD: disabled/unmanaged.
- **T2** — commit `ae37b88` (S1). Rutas anidadas bajo `/insumos`; duplicados de subcategoría solo dentro de la misma categoría. Mismos checks que T1. RDD: disabled/unmanaged.
- Líneas autoradas S1: ~1.300 (sobre el heurístico: la base compartida es una unidad coherente que usan todos los mantenedores).

## Siguiente paso
T3 en `feat/fase-4-insumos` y T4 en `feat/fase-4-proveedores` (apiladas).
