// Siembra los usuarios iniciales (Sprint2.md §2) con la service-role key.
// Uso: node --env-file=.env.seed scripts/seed-usuarios.mjs
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_PASSWORD.
// Idempotente: si el email ya existe se omite, sin tocar su clave ni sus datos.
// Nunca imprime la clave ni la key. La service-role key vive solo aquí, jamás en src/.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_PASSWORD } = process.env

const faltan = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SEED_PASSWORD'].filter((nombre) => !process.env[nombre])
if (faltan.length > 0) {
  console.error(`Faltan variables: ${faltan.join(', ')}. Defínelas en .env.seed (ver .env.seed.example).`)
  process.exit(1)
}

const usuarios = [
  { nombre: 'Richard', rol: 'productor' },
  { nombre: 'Jhona', rol: 'productor' },
  { nombre: 'Ana', rol: 'productor' },
  { nombre: 'Gerardo', rol: 'contador' },
  { nombre: 'Tac', rol: 'admin' },
  { nombre: 'Jorge', rol: 'admin' },
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Emails existentes (la lista es corta; se recorre por páginas por si acaso).
async function emailsExistentes() {
  const emails = new Set()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    data.users.forEach((u) => emails.add(u.email?.toLowerCase()))
    if (data.users.length < 200) return emails
  }
}

let fallos = 0
try {
  const existentes = await emailsExistentes()
  for (const { nombre, rol } of usuarios) {
    const email = `${nombre.toLowerCase()}@okima.cl`
    if (existentes.has(email)) {
      console.log(`omitido (ya existe): ${email}`)
      continue
    }
    const { error } = await supabase.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      // El rol va en app_metadata (solo editable con service role); el perfil se crea por trigger.
      app_metadata: { rol, nombre_mostrar: nombre },
      user_metadata: { debe_cambiar_clave: true },
    })
    if (error) {
      fallos++
      console.error(`error al crear ${email}: ${error.message}`)
    } else {
      console.log(`creado: ${email} (${rol})`)
    }
  }
} catch (error) {
  console.error(`No se pudo consultar Supabase: ${error.message}`)
  process.exit(1)
}
process.exit(fallos > 0 ? 1 : 0)
