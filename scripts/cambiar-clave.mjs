// Cambia la clave de un usuario existente con la service-role key (uso de administrador).
// Uso: NUEVA_CLAVE=... node --env-file=.env.seed scripts/cambiar-clave.mjs <nombre|email>
//   (en PowerShell: $env:NUEVA_CLAVE='...'; node --env-file=.env.seed scripts/cambiar-clave.mjs tac)
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y NUEVA_CLAVE (mínimo 8 caracteres).
// La clave nueva queda como TEMPORAL: se marca debe_cambiar_clave y el usuario elige la
// suya en su próximo ingreso. La clave actual no se puede leer (en la base solo hay un hash),
// únicamente reemplazar. Nunca imprime la clave ni la key. La service-role key vive solo aquí.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NUEVA_CLAVE } = process.env
const MINIMO = 8

const faltan = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NUEVA_CLAVE'].filter((nombre) => !process.env[nombre])
if (faltan.length > 0) {
  console.error(`Faltan variables: ${faltan.join(', ')}. Las dos primeras van en .env.seed; NUEVA_CLAVE se define al ejecutar.`)
  process.exit(1)
}
if (NUEVA_CLAVE.length < MINIMO) {
  console.error(`La clave nueva debe tener al menos ${MINIMO} caracteres.`)
  process.exit(1)
}

const destino = (process.argv[2] ?? '').trim().toLowerCase()
if (!destino) {
  console.error('Indica el usuario: un nombre (tac) o un email (tac@okima.cl).')
  process.exit(1)
}
const email = destino.includes('@') ? destino : `${destino}@okima.cl`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Busca el usuario por email (la lista es corta; se recorre por páginas por si acaso).
async function buscarUsuario() {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const encontrado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (encontrado) return encontrado
    if (data.users.length < 200) return null
  }
}

try {
  const usuario = await buscarUsuario()
  if (!usuario) {
    console.error(`No existe el usuario ${email}. No se creó ni se cambió nada.`)
    process.exit(1)
  }
  const { error } = await supabase.auth.admin.updateUserById(usuario.id, {
    password: NUEVA_CLAVE,
    // Se conserva el resto de user_metadata y se obliga a elegir una clave propia al entrar.
    user_metadata: { ...usuario.user_metadata, debe_cambiar_clave: true },
  })
  if (error) throw error
  console.log(`Clave temporal establecida para ${email}. Deberá cambiarla en su próximo ingreso.`)
} catch (error) {
  console.error(`No se pudo cambiar la clave: ${error.message}`)
  process.exit(1)
}
