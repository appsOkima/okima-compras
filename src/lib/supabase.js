import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase para toda la app. Sin login: la sesión no se
// persiste y todas las consultas van con el rol anon (RLS permisivo).
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY: copia .env.example a .env.local y complétalo.',
  )
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
