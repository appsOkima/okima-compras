# Fase 1 — Inicialización y Base de Datos

Locator: `odd/tasks/fase-1-inicializacion.md` · Engram mirror: `odd/fase-1-inicializacion/tasks` — **PENDIENTE** (Engram no disponible en esta sesión; resincronizar cuando lo esté).

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
- [ ] **T1 — Scaffold Vite + Tailwind + dependencias.** Ruta: inline (scaffold generado/mecánico; no dispara writer trigger). Aceptación: `npm run build` y `npm run lint` pasan; Tailwind activo.
- [ ] **T2 — `supabase/schema.sql`.** Ruta: inline (un solo archivo no trivial; lectura de 5 docs ≤ contexto ya cargado). Aceptación: 9 tablas + enum + FKs + vista + RLS permisivo — revisado contra el modelo de `CLAUDE.md`.

## Progreso / evidencia
(pendiente)

## Siguiente paso
T1.
