# Okima Compras

MVP para solicitudes de compra de insumos y registro de facturas de proveedores. Contexto y decisiones: `CLAUDE.md` e `historial-decisiones.md`.

Stack: React + Vite, Tailwind CSS, `lucide-react`, `react-router-dom`, Supabase (`@supabase/supabase-js`).

## Desarrollo

```bash
npm install
# crear .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Otros comandos: `npm test` (vitest, lógica pura de `src/lib/`), `npm run lint` (oxlint) y `npm run build`.

El cliente de Supabase está en `src/lib/supabase.js`; lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` desde `.env.local` (ignorado por git).

## Base de datos

El esquema completo está en `supabase/schema.sql`. Se ejecuta a mano en el SQL Editor del panel de Supabase.

Si la base se creó con un `schema.sql` anterior, ejecuta en orden los archivos pendientes de `supabase/migraciones/` (cada uno una sola vez). Una base nueva creada con el `schema.sql` actual no necesita ninguna.

**Regla: aplica TODAS las migraciones pendientes antes de desplegar el frontend.** El frontend del Sprint 2 consulta tablas, columnas y vistas que solo existen tras ellas (y el RLS por rol, tras la 11); con migraciones a medio aplicar, pantallas enteras fallan. No hay staging: respalda antes (en especial antes de la 07) y aplica de a una, en orden. El SQL Editor muestra solo el resultado de la última consulta: los `-verificacion.sql` de una sola consulta se ejecutan completos, con "No limit".

Cada migración tiene su reversa `-down.sql`. Orden de aplicación:

| N.º | Archivo (`2026-10-02-NN-...`) | Qué hace |
| --- | --- | --- |
| previa | `2026-09-28-descuento-pct.sql` | Descuentos de facturas de monto a porcentaje (`descuento_pct`). Solo para bases anteriores a esa fecha. |
| 01 | `renombrar-boletas` | `otros_gastos` pasa a `boletas` (conserva datos y FKs). |
| 02 | `notas-universal` | Agrega `notas` a las tablas que no la tenían y recrea `vista_solicitudes_pendientes`. |
| 03 | `quitar-notas-detalle-facturas` | Las líneas de factura no llevan `notas`. |
| 04 | `notas-impresion-solicitudes` | La vista de pendientes suma las notas que se imprimen. |
| 05 | `perfiles` | Tabla `perfiles`, enum de roles, `rol_actual()`, `id_solicitante` y `created_by`. Aditiva. |
| (seeding) | `scripts/seed-usuarios.mjs` | Crea los 6 usuarios (ver "Usuarios y login"). |
| 06 | `vincular-solicitantes` | Completa `solicitudes_compra.id_solicitante` por nombre. **Después del seeding.** |
| 07 | `insumos-proveedores-okima` | Pivote N:M con `factor_conversion` y `movimientos_stock`; elimina `id_insumo_okima` y `id_insumo_stock`/`qty_stock`. **Destructiva: respaldar.** Verificación: `07-verificacion`. |
| 08 | `detalle-boletas` | Líneas de boleta (una por boleta existente) y stock desde boletas. Verificación: `08-verificacion`. |
| 09 | `estado-anulado` | `estado_documento` y campos de anulación en facturas y boletas; `movimientos_stock.revertido`. Verificación: `09-verificacion`. |
| 10 | `pagos` | Tabla `pagos`, un pago histórico por documento existente y `vista_estado_pago`. Verificación: `10-verificacion`. |
| 11 | `rls-por-rol` | Reemplaza el RLS abierto por políticas por rol. **Aplicar solo con usuarios sembrados y login comprobado**; su reversa deja la base abierta. Verificación: `11-verificacion`; `11-pruebas-roles` prueba los roles sin dejar cambios. |
| 12 | `vinculo-solicitud-boletas` | `detalle_boletas.id_solicitud_compra` y exclusividad factura/boleta de las solicitudes. Verificación: `12-verificacion`. |
| 13 | `boletas-sin-concepto-ni-insumos` | Elimina `boletas.concepto` y `detalle_boletas.id_insumo_proveedor`; retira el stock de boletas (`movimientos_stock` solo de facturas, revirtiendo los movimientos de boleta existentes). Reversa: `-down`. Verificación: `13-verificacion`. **Rompe la interfaz anterior: aplicar la migración y desplegar el frontend juntos.** Exige que toda boleta tenga una línea con descripción. Las reversas 08 y 09 exigen revertir antes la 13. |
| 14 | `insumos-proveedores-se-vincula` | `insumos_proveedores.se_vincula` (boolean, default true): permite descartar insumos que nunca se vincularán ("Sin vínculo"). Aditiva. Reversa: `-down`. Verificación: `14-verificacion`. Desplegar el frontend después de aplicarla. |

Para borrar datos de prueba: `supabase/limpiar-datos.sql` vacía todas las tablas de negocio (incluidos pagos, líneas y movimientos de stock) salvo `categorias`, `subcategorias` y los usuarios/`perfiles` (irreversible).

Para cargar las facturas reales de la hoja de cálculo original: `supabase/cargar-facturas-reales.sql` (50 facturas, 110 líneas; crea los proveedores e insumos de proveedor que falten, sin vincular ni mover stock). Se detiene si las facturas ya están cargadas. Los proveedores nuevos quedan con RUT `POR COMPLETAR`.

## Despliegue (Vercel)

Importar el repositorio en Vercel (framework Vite; `vercel.json` ya redirige todas las rutas a `index.html` para react-router) y definir en Project Settings → Environment Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Las variables `VITE_*` se incrustan al compilar: tras cambiarlas hay que redesplegar. Aplica antes todas las migraciones (ver "Base de datos"). La app exige login y la base aplica RLS por rol (migración 11); sin esa migración el RLS sigue abierto y cualquiera con la URL puede leer y escribir.

## Usuarios y login

La app exige iniciar sesión (Supabase Auth). No hay registro abierto: los usuarios se siembran con `scripts/seed-usuarios.mjs`, que usa la service-role key (solo desde variable de entorno local, nunca en `src/`).

1. Aplicar `supabase/migraciones/2026-10-02-05-perfiles.sql`.
2. Crear `.env.seed` en la raíz (ignorado por git; la plantilla sin valores es `.env.seed.example`) con tres variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (clave service role del panel de Supabase) y `SEED_PASSWORD` (clave temporal común). La service-role key vive solo ahí y en el script, nunca en `src/` ni en `.env.local`.
3. `node --env-file=.env.seed scripts/seed-usuarios.mjs` (idempotente: omite los que ya existen y no toca su clave). Crea Richard, Jhona y Ana (productor), Gerardo (contador) y Tac y Jorge (admin), como `nombre@okima.cl`. Cada usuario debe cambiar la clave en su primer ingreso.
4. **Cambiar la clave de un usuario (administrador):** las claves no se pueden leer, solo reemplazar (en la base solo hay un hash en `auth.users`). Con `.env.seed` ya creado: `$env:NUEVA_CLAVE='clave-temporal'; node --env-file=.env.seed scripts/cambiar-clave.mjs tac` (PowerShell) o `NUEVA_CLAVE=clave-temporal node --env-file=.env.seed scripts/cambiar-clave.mjs tac`. Deja una clave temporal (mínimo 8 caracteres) y el usuario debe elegir la suya al ingresar. También se puede desde el panel de Supabase (Authentication → Users).
4. Aplicar `supabase/migraciones/2026-10-02-06-vincular-solicitantes.sql` (después de sembrar).

El rol de cada usuario sale de `app_metadata`; la matriz de permisos está en `CLAUDE.md` y `Sprint2.md` §2.1.

Se ingresa con el nombre (p. ej. `tac`) o el email completo (`tac@okima.cl`).
