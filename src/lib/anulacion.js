// Reglas de presentación del estado "Anulado" de facturas y boletas (sin React ni
// Supabase, para poder verificarlas con node). La base es quien revierte el stock,
// fija quién/cuándo anuló y hace cumplir los roles; esto solo arma textos y filtros.
import { formatoFechaLocal } from './formato.js'
import { etiquetaEstado } from './solicitudes.js'

export const estaAnulado = (doc) => doc?.estado_documento === 'anulado'

// Los anulados no cuentan en totales ni en el Resumen.
export const vigentes = (filas) => (filas ?? []).filter((f) => !estaAnulado(f))

// El motivo es obligatorio en la interfaz (en la base es opcional).
export const motivoValido = (motivo) => String(motivo ?? '').trim().length > 0

// Qué ocurrirá al anular o reactivar; `tipo` es 'factura' o 'boleta' (ambas femeninas).
export function resumenAnulacion(tipo, accion) {
  if (accion === 'reactivar') {
    return (
      `Al reactivar la ${tipo}: se vuelve a sumar el stock que sus líneas habían sumado, vuelve a contar en ` +
      `totales y en el Resumen, y se puede editar de nuevo.`
    )
  }
  return (
    `Al anular la ${tipo}: se revierte el stock sumado por sus líneas, deja de contar en totales y en el Resumen, ` +
    `y ya no se puede editar. Solo un administrador puede reactivarla.`
  )
}

// Líneas de detalle_facturas o detalle_boletas con `solicitud:solicitudes_compra(id, estado, solicitante,
// insumo:insumos(nombre))` → solicitudes distintas como "Insumo (solicitante, estado)".
// El estado se muestra como en la interfaz (Cancelada → Anulada).
export function solicitudesVinculadas(lineas) {
  const vistas = new Map()
  for (const linea of lineas ?? []) {
    const s = linea?.solicitud
    if (!s || vistas.has(s.id)) continue
    const detalle = [s.solicitante, etiquetaEstado(s.estado)].filter(Boolean).join(', ')
    vistas.set(s.id, `${s.insumo?.nombre ?? ''}${detalle ? ` (${detalle})` : ''}`.trim())
  }
  return [...vistas.values()]
}

// "Anulada el 05-10-2026 por Carla. Motivo: …"; omite lo que falte.
export function textoAnulacion(doc) {
  const cuando = doc?.anulado_at ? ` el ${formatoFechaLocal(doc.anulado_at)}` : ''
  const quien = doc?.perfil_anulo?.nombre_mostrar ? ` por ${doc.perfil_anulo.nombre_mostrar}` : ''
  const motivo = String(doc?.motivo_anulacion ?? '').trim()
  return `Anulada${cuando}${quien}.${motivo ? ` Motivo: ${motivo}` : ''}`
}
