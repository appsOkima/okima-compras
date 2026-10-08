// Nombre de una boleta, que ya no tiene concepto: la descripción de su primera línea
// (la más antigua por created_at, desempate por id), con " (+N más)" si hay más
// líneas, y "Boleta sin líneas" como último recurso. `lineas` = [{ id?, created_at?,
// descripcion }], p. ej. `lineas:detalle_boletas(descripcion, created_at)` embebido.
// Vive aparte de boletas.js para que solicitudes.js lo use sin ciclo de imports.
export const BOLETA_SIN_LINEAS = 'Boleta sin líneas'

const clave = (valor) => String(valor ?? '')

export function nombreBoleta(lineas) {
  const ordenadas = [...(lineas ?? [])].sort(
    (a, b) => clave(a.created_at).localeCompare(clave(b.created_at)) || clave(a.id).localeCompare(clave(b.id)),
  )
  const primera = String(ordenadas[0]?.descripcion ?? '').trim()
  if (!primera) return BOLETA_SIN_LINEAS
  return ordenadas.length > 1 ? `${primera} (+${ordenadas.length - 1} más)` : primera
}
