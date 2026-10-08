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
  '/pagos',
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

// Pagos (Sprint2 §2.1): el contador los registra y los lee; editar y borrar es solo del
// admin. La sección global /pagos también es solo del admin (ver la matriz de arriba).
export const puedeRegistrarPago = (rol) => rol === 'contador' || rol === 'admin'

export const puedeEditarPago = (rol) => rol === 'admin'

export const puedeBorrarPago = (rol) => rol === 'admin'

// Crear / editar / borrar por entidad (migración T3b, rls-por-rol; ahí está la matriz
// completa). Un UPDATE o DELETE denegado por el RLS no da error, afecta 0 filas: por eso
// la interfaz no ofrece lo que el rol no puede hacer. Facturas y boletas: el contador
// borra solo la cabecera de un guardado fallido (rollback), no hay botón. Entidad o
// acción desconocida, rol desconocido o sin perfil: nada.
const C = 'crear'
const U = 'editar'
const D = 'borrar'
const todo = [C, U, D]
const contadorEstandar = [C, U]

const permisosPorEntidad = {
  solicitudes: { productor: [C, U], contador: [C, U], admin: todo },
  proveedores: { contador: contadorEstandar, admin: todo },
  catalogo: { contador: contadorEstandar, admin: todo },
  insumos: { productor: [C, U], contador: [C, U], admin: todo },
  vinculos: { productor: [C, U], contador: todo, admin: todo },
  facturas: { contador: contadorEstandar, admin: todo },
  boletas: { contador: contadorEstandar, admin: todo },
  plantillas: { admin: todo },
  categorias: { admin: todo },
  subcategorias: { admin: todo },
}

export const puedeHacer = (rol, entidad, accion) =>
  esRolValido(rol) && (Object.hasOwn(permisosPorEntidad, entidad) ? (permisosPorEntidad[entidad][rol]?.includes(accion) ?? false) : false)
