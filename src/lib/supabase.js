import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase para toda la app. Sin login: la sesión no se
// persiste y todas las consultas van con el rol anon (RLS permisivo).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY: defínelas en .env.local (Project URL y clave pública de Supabase).',
  )
}

// La librería agrega /rest/v1 sola; una URL con ruta rompe todas las consultas.
if (new URL(url).pathname !== '/') {
  throw new Error(
    `VITE_SUPABASE_URL debe ser solo la Project URL (ej. https://tu-proyecto.supabase.co), sin /rest/v1 ni otra ruta. Valor actual: ${url}`,
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
