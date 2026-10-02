# Okima Compras

MVP para solicitudes de compra de insumos y registro de facturas de proveedores. Contexto y decisiones: `CLAUDE.md` e `historial-decisiones.md`.

Stack: React + Vite, Tailwind CSS, `lucide-react`, `react-router-dom`, Supabase (`@supabase/supabase-js`).

## Desarrollo

```bash
npm install
# crear .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

El cliente de Supabase está en `src/lib/supabase.js`; lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` desde `.env.local` (ignorado por git).

## Base de datos

El esquema completo está en `supabase/schema.sql`. Se ejecuta a mano en el SQL Editor del panel de Supabase.

Si la base se creó con un `schema.sql` anterior, ejecuta en orden los archivos pendientes de `supabase/migraciones/` (cada uno una sola vez).

Para borrar datos de prueba: `supabase/limpiar-datos.sql` vacía todas las tablas salvo `categorias` y `subcategorias` (irreversible).

Para cargar datos de prueba en todas las tablas: `supabase/datos-prueba.sql` (proveedores, insumos, solicitudes, facturas, gastos…; pasa por los triggers reales). Se detiene si ya están cargados: correr antes `limpiar-datos.sql`.

Para cargar las facturas reales de la hoja de cálculo original: `supabase/cargar-facturas-reales.sql` (50 facturas, 110 líneas; crea los proveedores e insumos de proveedor que falten, sin vincular ni mover stock). Se detiene si las facturas ya están cargadas. Los proveedores nuevos quedan con RUT `POR COMPLETAR`.

## Despliegue (Vercel)

Importar el repositorio en Vercel (framework Vite; `vercel.json` ya redirige todas las rutas a `index.html` para react-router) y definir en Project Settings → Environment Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Las variables `VITE_*` se incrustan al compilar: tras cambiarlas hay que redesplegar. La app no tiene login y el RLS es permisivo, así que cualquiera con la URL puede leer y escribir la base.

## Usuarios y login

La app exige iniciar sesión (Supabase Auth). No hay registro abierto: los usuarios se siembran con `scripts/seed-usuarios.mjs`, que usa la service-role key (solo desde variable de entorno local, nunca en `src/`).

1. Aplicar `supabase/migraciones/2026-10-02-05-perfiles.sql`.
2. Copiar `.env.seed.example` a `.env.seed` (ignorado por git) y completar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SEED_PASSWORD` (clave temporal común).
3. `node --env-file=.env.seed scripts/seed-usuarios.mjs` (idempotente: omite los que ya existen). Cada usuario debe cambiar la clave en su primer ingreso.
4. Aplicar `supabase/migraciones/2026-10-02-06-vincular-solicitantes.sql` (después de sembrar).

Se ingresa con el nombre (p. ej. `tac`) o el email completo (`tac@okima.cl`).
