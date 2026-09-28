# Fase 1 — Inicialización y Base de Datos

Locator: `odd/tasks/fase-1-inicializacion.md` · Engram mirror: `odd/fase-1-inicializacion/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Crear el proyecto React + Vite + Tailwind y el `schema.sql` de Supabase (tablas, FKs, enum, vista `vista_solicitudes_pendientes`, RLS permisivo), según `CLAUDE.md`.

## Problema / por qué
Repo vacío (solo documentación). Fase 1 es la base de todas las siguientes; el usuario ejecutará el SQL manualmente en su panel de Supabase.

## Alcance autorizado
- Scaffold Vite (React) en la raíz del repo, con Tailwind, `react-router-dom`, `@supabase/supabase-js`, `lucide-react` instalados.
- `supabase/schema.sql` completo.
- Fuera de alcance: cliente Supabase / `.env` (Fase 2), layout y rutas (Fase 3).

## Restricciones
- No avanzar a Fase 2 sin aprobación explícita.
- Sin `UNIQUE` sobre `nombre`; sí `UNIQUE (id_proveedor, numero_factura)`.
- `nivel_urgencia` como ENUM `('Baja','Media','Alta')`; la vista ordena Alta → Media → Baja.
- Todo CLP; campos nullable según creación al vuelo.

## Modo TDD
Off — fuente: sin configuración de proyecto/sesión ni pedido del usuario. Runner: ninguno aún. Checks funcionales: `npm run build`, `npm run lint`.

## RDD
`gentle-ai review mode status` → off (global). Entrega: `disabled/unmanaged`. Estrategia de entrega: `ask-on-risk`. Pronóstico: ~300 líneas autoradas (excluye archivos generados por el scaffold y lockfile).

## Tareas
- [x] **T1 — Scaffold Vite + Tailwind + dependencias.** Ruta: inline (scaffold generado/mecánico; no dispara writer trigger). Aceptación: `npm run build` y `npm run lint` pasan; Tailwind activo.
- [x] **T2 — `supabase/schema.sql`.** Ruta: inline (un solo archivo no trivial; lectura de 5 docs ≤ contexto ya cargado). Aceptación: 9 tablas + enum + FKs + vista + RLS permisivo — revisado contra el modelo de `CLAUDE.md`.
- [x] **T2b — Trigger solicitud→Comprada.** Ruta: inline (1 archivo). Aceptación: línea con `id_solicitud_compra` (insert o update) deja la solicitud en `'Comprada'`.
- [x] **T3 — Categorías (centros de costo) + subcategorías.** Ruta: inline (solo `supabase/schema.sql`; CSV y schema ya leídos). Alcance: tabla `subcategorias` (`id_categoria`, `nombre`, `descripcion` ← "Items Incluidos", `activo`); `id_categoria` → `id_subcategoria` en `insumos` (obligatoria), `otros_gastos` y `plantillas_gastos_recurrentes` (opcionales); semilla desde `centros_de_costo.csv`; plantillas vinculadas a su subcategoría. Aceptación: 10 categorías + 34 subcategorías sembradas; RLS en `subcategorias`; schema corre limpio en PGlite.
- [x] **T4 — `insumos.qty` decimal + trigger de stock.** Ruta: inline (1 archivo). Alcance: `qty numeric`; trigger en `detalle_facturas` suma `cantidad × coalesce(cantidad_formato, 1)` solo si el `insumo_proveedor` está vinculado al guardar la línea; sin efecto retroactivo al vincular después; editar/borrar la línea revierte exactamente lo aplicado (snapshot en la línea). Aceptación: pruebas en PGlite de insert vinculado/no vinculado, vínculo posterior sin efecto, edición, borrado y borrado en cascada de factura.
- [x] **T5 — Documentación.** Ruta: delegado (writer trigger: `CLAUDE.md`, `historial-decisiones.md`, `creacion-al-vuelo.md`, `mantenedor-crud.md`). Alcance: reflejar subcategorías, `qty` decimal, stock no retroactivo y el trigger de solicitudes.

## Progreso / evidencia
- **T1** — commit `fdd2054`. Vite 8 + React 19, Tailwind v4 (`@tailwindcss/vite`), `react-router-dom`, `@supabase/supabase-js`, `lucide-react`. `npm run build` OK (clase Tailwind presente en el CSS generado); `oxlint` exit 0. `.env*` ignorado (salvo `.env.example`). RDD: disabled/unmanaged.
- **T2** — commit `7879e4c`. `supabase/schema.sql` ejecutado completo en PGlite (Postgres WASM) con roles `anon`/`authenticated` simulados: 9 tablas con RLS + 9 políticas; vista ordena Alta→Media→Baja, luego fecha tope, y deduplica proveedores sugeridos; verificados UNIQUE factura por proveedor, NOT NULL de `rut` e `id_categoria`, CHECK de `estado`. No verificado: ejecución en Supabase real (la hace el usuario). RDD: disabled/unmanaged.
- **T2b** — commit `303c0bd` (hecho por el usuario). Verificado en PGlite: insert con solicitud → 'Comprada'; asociar después → 'Comprada'; otras quedan 'Pendiente'. RDD: disabled/unmanaged.
- **T3** — commit `3b2d061`. PGlite: 10 categorías + 34 subcategorías, 0 sin descripción; plantillas vinculadas (Arriendo→Infraestructura, Sueldos→Remuneraciones, Pago IVA→Impuestos y Finanzas); RLS + política en `subcategorias`; insumo sin subcategoría rechazado; gasto sin subcategoría aceptado. RDD: disabled/unmanaged.
- **T4** — commit `c62392f`. PGlite, 13/13 escenarios: vinculada 1.5×2.5=3.75; no vinculada no suma; vincular después no retroactivo; editar precio conserva; cambiar `cantidad_formato` después no altera lo aplicado; editar cantidad recalcula; `cantidad_formato` vacío = 1; el cliente no puede fijar el snapshot; borrar factura en cascada revierte a 0. Decisión: snapshot `id_insumo_stock`/`qty_stock` en `detalle_facturas` para revertir exacto. RDD: disabled/unmanaged.
- **T5** — commit `2b08ae8` (docs: CLAUDE.md, historial-decisiones.md, creacion-al-vuelo.md, mantenedor-crud.md). Delegado a un writer; diff revisado por el orquestador contra el schema. Sin desacuerdos nuevos (los docs siguen omitiendo defaults menores del schema, como antes). RDD: disabled/unmanaged.
- Decisiones menores: regla solicitud→Comprada agregada como trigger `detalle_facturas_marcar_solicitud_comprada` (insert o update de `id_solicitud_compra`; verificado en PGlite). Semilla de plantillas Arriendo/Sueldos/Pago IVA con `monto_default = 0`.
- Decisiones del usuario (2026-09-28): estado sigue siendo `'Comprada'` (no 'Completada'); stock de `insumos_proveedores` no vinculados no se guarda ni se aplica al vincular después; `insumos.qty` acepta decimales; categorías = centros de costo de `centros_de_costo.csv` con subcategorías; insumos/gastos/plantillas referencian **solo** la subcategoría.
- Líneas autoradas: ~420 (sin lockfile) en T1–T2, más ~200 en T2b–T4; sobre el heurístico (estrategia `ask-on-risk`: preguntar estrategia de cadena antes de abrir PR); sin PR aún.

## Siguiente paso
Usuario revisa el schema refinado; cuando esté conforme, lo ejecuta completo en el SQL Editor de Supabase (base limpia) y aprueba la Fase 2.
