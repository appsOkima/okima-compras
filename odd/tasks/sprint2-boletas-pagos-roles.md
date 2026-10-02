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

- [x] **T1 Renombrado Otros Gastos → Boletas.** SQL: `otros_gastos` → `boletas` (+ FKs/políticas/comentarios), `datos-prueba.sql`/`limpiar-datos.sql`. Front: `src/pages/gastos/` → `boletas`, ruta `/boletas`, título en `secciones.js`, `Resumen.jsx`, CSV. Docs.
- [x] **T2 `notas` universal.** SQL con `ADD COLUMN IF NOT EXISTS` en las tablas de §1.2; componente de notas que no ocupa espacio vacío y se destaca si hay contenido, integrado en formularios, listados y detalle.
- [x] **T3a Perfiles, seeding y login (aditiva, RLS aún permisivo).** `perfiles` (+ enum `rol`, trigger que lee el rol de `raw_app_meta_data`, nunca de `user_metadata`), `rol_actual()`, columnas `id_solicitante`/`created_by`; script Node de seeding (`scripts/seed-usuarios.mjs`, lee `.env.seed`); migración que vincula `solicitante` → `id_solicitante` (se corre después del seeding); login, sesión persistente, cambio de clave forzado, `ProtectedRoute` y menú por rol (`src/lib/permisos.js` con tests).
- [ ] **T3b RLS por rol (corte de acceso).** Reemplaza `acceso_publico` por políticas por rol según la matriz §2.1, con reversa que restaura `acceso_publico`. Se aplica SOLO después de sembrar usuarios y comprobar el login. Las pruebas se hacen en el mismo proyecto de Supabase (decisión del usuario): ver riesgo.
- [x] **T4a N:M en base de datos.** `insumos_proveedores_okima` (UNIQUE, factor > 0) + migración de vínculos con `factor = COALESCE(cantidad_formato,1)`; `movimientos_stock` (con triggers de suma/resta sobre `insumos.qty`) en lugar de `id_insumo_stock`/`qty_stock`, copiando lo ya aplicado SIN reaplicarlo; retirar `insumos_proveedores.id_insumo_okima`; reescribir `vista_solicitudes_pendientes` conservando las columnas de notas.
- [x] **T4b N:M en la interfaz.** Catálogo (vínculos con factor), "Por vincular", vínculo desde Facturas con factor, detalle de factura y líneas leyendo `movimientos_stock`, selectores que usaban `id_insumo_okima`.
- [ ] **T5a `detalle_boletas` en base de datos (sin `notas`).** Tabla de líneas (`descripcion`, `id_insumo_proveedor` opcional, `cantidad`, `precio`, `subtotal`); `boletas.monto` pasa a ser el total de las líneas (calculado por la interfaz); migración de cada boleta existente a una línea única; `movimientos_stock` se extiende (`id_detalle_boleta`, CHECK `num_nonnulls = 1`) y un trigger genera stock desde líneas de boleta con la pivote; `id_solicitud_compra` en las líneas se agrega en T8.
- [ ] **T5b `detalle_boletas` en la interfaz.** Boleta maestro-detalle (cabecera + líneas), ingreso rápido desde plantilla crea boleta con una línea, stock sumado visible, Resumen sin cambios (sigue sumando `boletas.monto` hasta T7).
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
- **T1** (ruta **D**, trigger de escritor: 2+ archivos no triviales): lint y build pasan (verificado por mí tras el agente); sin lógica testeable, no hay tests; `npm test` sin archivos. Migración `supabase/migraciones/2026-10-02-01-renombrar-boletas.sql` (+ `-down`) **pendiente de aplicar por el usuario** en staging. RDD desactivado (`gentle-ai review mode status`: off, global) → revisión nativa: disabled/unmanaged. Redirección `/gastos/*` → `/boletas`. Commit: ver `git log` (feat(boletas)).
- **T2 ajuste** (ruta **I**, mecánico): el usuario retiró `notas` de las líneas (`detalle_facturas` y futuro `detalle_boletas`). Migración `2026-10-02-03-quitar-notas-detalle-facturas.sql` (+ `-down`) la elimina si existe; se quitó de `schema.sql`, `lib/facturas.js`, `LineaFactura`, `DetalleFactura`, `Lineas` y `FormularioFactura`. Vitest 6/6, lint y build pasan. Pendiente de aplicar por el usuario.
- **T4b** (ruta **D**, escritor; interfaz): RED observado (`Cannot find module './vinculos'`; 15 fallos en `facturas.test.js`), GREEN 68/68; lint y build pasan (re-verificados por mí; sin referencias a columnas eliminadas). NO probada contra Supabase real ni en navegador. Riesgos: embeds PostgREST dependen de la migración 07; guardado del catálogo (insumo + vínculos) no atómico. Despliegue conjunto con la migración 07. RDD off → disabled/unmanaged.
- **T4a** (ruta **D**, escritor; SQL): migración `2026-10-02-07-insumos-proveedores-okima.sql` (+ `-down`, + `-07-verificacion.sql` solo lectura). Revisada por mí línea a línea (transacción única, comprobaciones previas, copia verificada por total y por insumo antes de crear triggers, vista reescrita antes de borrar la columna). **No validada por parser ni ejecutada**: no hay Postgres local. Cambio deliberado: `cantidad_formato = 0` migra con factor 1. Al aplicarla el frontend viejo deja de funcionar: aplicar junto con T4b; respaldar antes `insumos_proveedores.id_insumo_okima`, `detalle_facturas.id_insumo_stock/qty_stock` e `insumos.qty`. RDD off → disabled/unmanaged.
- **T3a** (ruta **D**, escritor): vitest 24/24 (RED observado en `credenciales`; en `permisos` el import falló pero no se capturó la salida), lint y build pasan (re-verificados). Revisé migración 05 (rol solo desde `raw_app_meta_data`, sin perfil si falta rol, `rol_actual()` SECURITY DEFINER) y el script de seeding (no imprime claves; no se ejecutó). NO probado contra Supabase real ni en navegador. Pendiente: `id_solicitante` desde el formulario (solo lo llena la migración 06 a los históricos). Orden de despliegue: migraciones 01–05 → crear `.env.seed` y correr seeding → migración 06 → desplegar frontend. Hasta el seeding nadie puede entrar al frontend nuevo. RDD off → disabled/unmanaged.
- **T2 ajuste 2** (ruta **I**): las notas dejan de verse en las tablas (`TablaDatos` ya no pinta fila de nota; nueva prop `detalleImpresion`, solo papel). En la impresión de Pendientes se muestran bajo cada solicitud: nota de la solicitud, de proveedores sugeridos, de insumos de catálogo y del insumo Okima. TDD: RED (`notasImpresion is not a function`, 3 fallos) → GREEN 9/9; lint y build pasan. Migración `2026-10-02-04-notas-impresion-solicitudes.sql` (+ `-down`) recrea la vista con `notas_insumo`, `notas_proveedores`, `notas_catalogo`; **pendiente de aplicar por el usuario**. Impresión no probada en navegador. En T4 la vista se reescribe para la pivote N:M y debe conservar estas columnas.
- **T2** (ruta **D**, escritor): RED observado (`Cannot find module './notas'`), GREEN 6/6 con `npx vitest run`; lint y build pasan (re-verificados por mí). Migración `2026-10-02-02-notas-universal.sql` (+ `-down`) **pendiente de aplicar por el usuario**; recrea `vista_solicitudes_pendientes` con `notas`. UI no probada en navegador. `detalle_boletas` queda para T5. `supabase/datos-prueba.sql` aparece eliminado en el árbol (lo borró el usuario): no se incluye en commits. RDD off → disabled/unmanaged.
- Commit de preparación: docs (`Sprint2.md`, `CLAUDE.md`, este documento).

## Siguiente paso

Aplicar 07 + desplegar T4b (usuario) (hecho: usuario probó T4). Ahora T5a. T3b (RLS por rol) queda pendiente: el usuario ya comprobó el login real con los perfiles; falta decidir cuándo cortar el acceso.
