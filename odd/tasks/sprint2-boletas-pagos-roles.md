# Sprint 2 — Boletas, Pagos, Roles y Vinculación

- **Feature:** `sprint2-boletas-pagos-roles` · **Rama:** `feat/sprint2-boletas-pagos-roles`
- **Fuente de requisitos:** `Sprint2.md` (manda sobre `CLAUDE.md` donde difieran).
- **Espejo Engram:** `odd/sprint2-boletas-pagos-roles/tasks` — **pendiente** (herramientas de memoria no disponibles en esta sesión; se resincroniza cuando haya acceso).
- **TDD:** ON (elección explícita del usuario). **Runner:** `vitest` (se instala en la preparación; script `npm test`). RED→GREEN→REFACTOR en lógica pura (`src/lib/*`); en cambios de solo SQL/renombrado/UI sin lógica nueva se registra "sin lógica testeable" y se verifica con lint + build + revisión del SQL.
- **Checks funcionales:** `npm test`, `npm run lint`, `npm run build`, revisión del SQL contra `supabase/schema.sql`.
- **Estrategia de entrega:** una rama, commits de work-unit por tarea, un solo PR final (elección del usuario); push y merge son decisión del usuario. Pronóstico ≈2500–3500 líneas, sobre el heurístico de ~400, declarado y aceptado.

## Restricciones operativas

- Las migraciones se aplican **a mano** en el SQL Editor de Supabase (no hay CLI). Cada una va en `supabase/migraciones/AAAA-MM-DD-NN-nombre.sql` con su reversa `...-down.sql`. El usuario las ejecuta; el frontend de cada tarea depende de que su migración esté aplicada.
- Se actualiza `supabase/schema.sql` al final de cada tarea para que siga siendo el esquema completo de una base limpia.
- Los scripts de seeding usan la service-role key solo desde variable de entorno local, nunca en `src/`.

## Tareas

Orden fijado por `Sprint2.md` §0. Ruta: **I** = inline, **D** = delegado (se registra la evidencia del trigger).

- [ ] **T1 Renombrado Otros Gastos → Boletas.** SQL: `otros_gastos` → `boletas` (+ FKs/políticas/comentarios), `datos-prueba.sql`/`limpiar-datos.sql`. Front: `src/pages/gastos/` → `boletas`, ruta `/boletas`, título en `secciones.js`, `Resumen.jsx`, CSV. Docs.
- [ ] **T2 `notas` universal.** SQL con `ADD COLUMN IF NOT EXISTS` en las tablas de §1.2; componente de notas que no ocupa espacio vacío y se destaca si hay contenido, integrado en formularios, listados y detalle.
- [ ] **T3 Perfiles, Auth y RLS por rol.** `perfiles` + trigger + `rol_actual()`; reemplazo de `acceso_publico` por políticas por rol (matriz §2.1); script Node de seeding (`SEED_PASSWORD`, emails `nombre@okima.cl`, forzar cambio de clave); login, sesión persistente, `ProtectedRoute`, menú por rol; `id_solicitante`/`created_by`.
- [ ] **T4 N:M insumos.** `insumos_proveedores_okima` + migración de vínculos con `factor = COALESCE(cantidad_formato,1)`; retirar `insumos_proveedores.id_insumo_okima`; `movimientos_stock` y triggers reescritos; reescribir `vista_solicitudes_pendientes`; UI de catálogo, "Por vincular" y vínculo desde Facturas con factor.
- [ ] **T5 `detalle_boletas`.** Cabecera de boleta con total, líneas, migración de cada boleta a una línea única, stock por pivote, UI de líneas de boleta.
- [ ] **T6 Estado Anulado.** `estado_documento` + auditoría en `facturas` y `boletas`; reversa de stock al anular; UI con confirmación; permisos Contador/Admin; mostrar "Anulada" para solicitudes `Cancelada`.
- [ ] **T7 Pagos.** Tabla `pagos` + migración idempotente de pagos históricos (con verificación Σ pagos = Σ totales); vista `estado_pago`; `Resumen` pasa a sumar `pagos` de documentos vigentes con prorrateo por subcategoría; pestaña "Cuotas/Pagos"; permisos Contador CR / Admin CRUD.
- [ ] **T8 Vinculación solicitud ↔ línea.** `detalle_boletas.id_solicitud_compra`, trigger de exclusividad factura/boleta, trigger 'Comprada' extendido; aviso al cancelar/anular.
- [ ] **T9 UI de vinculación y flujo de pago.** Modal de solicitudes con orden por coincidencia de insumo, filtro "No vinculadas", vinculación inline (también desde solicitudes sueltas), switch "¿Pagado al contado?" con RPC transaccional, tokens de paleta.
- [ ] **T10 Cierre.** `CLAUDE.md` e `historial-decisiones.md` alineados, `schema.sql` consolidado, criterios de aceptación de `Sprint2.md` §4 verificados.

## Criterios de aceptación

Los de `Sprint2.md` §4.

## Progreso y evidencia

- Mapa del repo (subagente de exploración, solo lectura): no hay tests ni runner; SQL aplicado a mano; todo el SQL de negocio está en `supabase/schema.sql`; `otros_gastos` aparece en `FormularioGasto.jsx`, `Gastos.jsx`, `Resumen.jsx` y SQL de prueba. El resumen hoy se calcula en el cliente (`src/lib/resumen.js`).
- Ruta de la exploración: **D** (trigger de mapeo, 4+ archivos).
- Commit de preparación: docs (`Sprint2.md`, `CLAUDE.md`, este documento).

## Siguiente paso

Resolver TDD y estrategia de cadena de PRs; luego T1.
