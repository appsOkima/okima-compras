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
