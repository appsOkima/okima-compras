// Traduce errores de Supabase/PostgreSQL a mensajes entendibles para el usuario.
export const CODIGO_EN_USO = '23503'

export function mensajeError(error) {
  if (!error) return ''
  switch (error.code) {
    case CODIGO_EN_USO:
      return 'No se puede eliminar: el registro está en uso por otros datos.'
    case '23505':
      return 'Ya existe un registro con esos datos.'
    case '23502':
      return 'Falta completar un campo obligatorio.'
    default:
      return error.message || 'Ocurrió un error inesperado.'
  }
}
