// Traduce errores de Supabase/PostgreSQL a mensajes entendibles para el usuario.
export const CODIGO_EN_USO = '23503'

// Un UPDATE o DELETE denegado por el RLS sobre una fila visible no da error: afecta 0 filas.
export const MENSAJE_SIN_FILAS = 'No tienes permiso para esta acción o el registro ya no existe.'

// Para update/delete con .select('id'): error si no cambiaron las filas esperadas, null si sí.
export const errorSinFilas = (data, esperadas = 1) =>
  Array.isArray(data) && data.length >= esperadas ? null : new Error(MENSAJE_SIN_FILAS)

export function mensajeError(error) {
  if (!error) return ''
  switch (error.code) {
    case CODIGO_EN_USO:
      return 'No se puede eliminar: el registro está en uso por otros datos.'
    case '23505':
      return 'Ya existe un registro con esos datos.'
    case '23502':
      return 'Falta completar un campo obligatorio.'
    case '42501':
      // Los triggers de la base (anular/reactivar) traen su mensaje en español; el
      // rechazo del RLS llega en inglés y se reemplaza por uno entendible.
      return error.message && !/row-level security|permission denied/i.test(error.message)
        ? error.message
        : 'Tu rol no tiene permiso para realizar esta acción.'
    case 'PGRST116':
      // update(...).select().single() sin filas: el RLS lo denegó o el registro ya no existe.
      return MENSAJE_SIN_FILAS
    default:
      return error.message || 'Ocurrió un error inesperado.'
  }
}
