// Matriz de acceso por rol a las secciones del menú (Sprint2.md §2.1). Las claves
// son los `path` de secciones.js. Es solo ergonomía de la interfaz: la seguridad
// real es el RLS de la base.
const productor = ['/solicitudes', '/proveedores', '/insumos']
const contador = ['/solicitudes', '/facturas', '/boletas', '/proveedores', '/insumos']
const admin = [
  '/solicitudes',
  '/facturas',
  '/boletas',
  '/resumen',
  '/proveedores',
  '/insumos',
  '/centros-costo',
]

const porRol = new Map([
  ['productor', productor],
  ['contador', contador],
  ['admin', admin],
])

export const esRolValido = (rol) => typeof rol === 'string' && porRol.has(rol)

// Rol desconocido o ausente: sin acceso a nada.
export const seccionesPermitidas = (rol) => (esRolValido(rol) ? porRol.get(rol) : [])

// `ruta` puede ser la sección o una subruta (/solicitudes/todas).
export const puedeVerSeccion = (rol, ruta) =>
  seccionesPermitidas(rol).some((path) => ruta === path || ruta.startsWith(`${path}/`))

export const rutaInicial = (rol) => seccionesPermitidas(rol)[0] ?? null

// Anular facturas y boletas: contador y admin; reactivar un documento anulado: solo
// admin. Como el resto, es ergonomía de la interfaz: la base lo exige con rol_actual().
export const puedeAnular = (rol) => rol === 'contador' || rol === 'admin'

export const puedeReactivar = (rol) => rol === 'admin'
