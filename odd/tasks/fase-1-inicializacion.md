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

## Progreso / evidencia
- **T1** — commit `fdd2054`. Vite 8 + React 19, Tailwind v4 (`@tailwindcss/vite`), `react-router-dom`, `@supabase/supabase-js`, `lucide-react`. `npm run build` OK (clase Tailwind presente en el CSS generado); `oxlint` exit 0. `.env*` ignorado (salvo `.env.example`). RDD: disabled/unmanaged.
- **T2** — commit `7879e4c`. `supabase/schema.sql` ejecutado completo en PGlite (Postgres WASM) con roles `anon`/`authenticated` simulados: 9 tablas con RLS + 9 políticas; vista ordena Alta→Media→Baja, luego fecha tope, y deduplica proveedores sugeridos; verificados UNIQUE factura por proveedor, NOT NULL de `rut` e `id_categoria`, CHECK de `estado`. No verificado: ejecución en Supabase real (la hace el usuario). RDD: disabled/unmanaged.
- Decisiones menores: reglas de negocio (stock y solicitud→Comprada) **no** van como triggers en esta fase — quedan como pregunta abierta. Semilla de plantillas Arriendo/Sueldos/Pago IVA con `monto_default = 0`. Categorías sin semilla (lista pendiente del usuario).
- Líneas autoradas: ~420 (sin lockfile), sobre el heurístico por los archivos del scaffold; sin PR aún.

## Siguiente paso
Usuario ejecuta `supabase/schema.sql` en el SQL Editor de Supabase y aprueba la Fase 2.
