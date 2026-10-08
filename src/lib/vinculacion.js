// Reglas de las listas de vinculación solicitud ↔ línea (modal de solicitudes y modal
// de líneas), sin React ni Supabase para poder verificarlas con node.
import { ordenarSolicitudesParaLinea } from './facturas.js'
import { nombreBoleta } from './nombreBoleta.js'
import { coincide } from './texto.js'

// Solicitudes que ofrece el modal de una línea, ya ordenadas: primero las que comparten
// insumo Okima con alguno de los vinculados al insumo del proveedor de la línea
// (`idsInsumoOkima`, vía la pivote N:M), luego el resto por urgencia y fecha tope.
// `excluir`: ids elegidos en otras líneas del mismo documento. Las ocupadas por el otro
// tipo de documento se quitan antes con solicitudesDisponibles. `busqueda`: insumo o
// solicitante. Devuelve [{ solicitud, coincide }].
export function solicitudesParaModal(solicitudes, { idsInsumoOkima = [], excluir = [], busqueda = '' } = {}) {
  const fuera = new Set(excluir)
  const mismos = new Set(idsInsumoOkima)
  const visibles = (solicitudes ?? []).filter(
    (s) =>
      !fuera.has(s.id) &&
      (!busqueda || [s.insumo_nombre ?? s.insumo?.nombre, s.solicitante].some((v) => coincide(v, busqueda))),
  )
  return ordenarSolicitudesParaLinea(visibles, idsInsumoOkima).map((solicitud) => ({
    solicitud,
    coincide: mismos.has(solicitud.id_insumo_okima),
  }))
}

// Fila de detalle_facturas (con `factura:facturas(numero_factura, fecha, estado_documento,
// proveedor:proveedores(nombre))` e `insumo_proveedor:insumos_proveedores(nombre,
// vinculos:insumos_proveedores_okima(id_insumo_okima))`) → forma común de línea vinculable.
export function lineaFacturaParaVincular(fila) {
  return {
    tipo: 'factura',
    id: fila.id,
    documento: `Factura N° ${fila.factura?.numero_factura ?? '?'}`,
    fecha: fila.factura?.fecha ?? null,
    proveedor: fila.factura?.proveedor?.nombre ?? '',
    descripcion: fila.insumo_proveedor?.nombre ?? '',
    idsInsumoOkima: (fila.insumo_proveedor?.vinculos ?? []).map((v) => v.id_insumo_okima),
    cantidad: fila.cantidad,
    subtotal: fila.subtotal,
    idSolicitud: fila.id_solicitud_compra ?? null,
    anulado: fila.factura?.estado_documento === 'anulado',
  }
}

// Igual para detalle_boletas (con `boleta:boletas(numero_documento, fecha, estado_documento,
// proveedor:proveedores(nombre), lineas:detalle_boletas(descripcion, created_at))`). La
// descripción es la de la línea; las boletas no tienen insumo, así que no hay insumos Okima.
export function lineaBoletaParaVincular(fila) {
  const b = fila.boleta
  return {
    tipo: 'boleta',
    id: fila.id,
    documento: `Boleta «${nombreBoleta(b?.lineas)}»${b?.numero_documento ? ` N° ${b.numero_documento}` : ''}`,
    fecha: b?.fecha ?? null,
    proveedor: b?.proveedor?.nombre ?? '',
    descripcion: fila.descripcion ?? '',
    idsInsumoOkima: [],
    cantidad: fila.cantidad,
    subtotal: fila.subtotal,
    idSolicitud: fila.id_solicitud_compra ?? null,
    anulado: b?.estado_documento === 'anulado',
  }
}

// Una línea se puede vincular desde una tabla si no tiene solicitud y su documento sigue vigente.
export const esVinculable = (linea) => !linea.idSolicitud && !linea.anulado

// Líneas que ofrece el modal inverso para una solicitud suelta: solo vinculables; primero
// las cuyo insumo Okima coincide con el de la solicitud, luego las más recientes.
// `tipo` ('factura' | 'boleta' | '') y `busqueda` (documento, proveedor, descripción) filtran.
// Devuelve [{ linea, coincide }].
export function lineasParaSolicitud(lineas, solicitud, { tipo = '', busqueda = '' } = {}) {
  const filas = (lineas ?? [])
    .filter(
      (l) =>
        esVinculable(l) &&
        (!tipo || l.tipo === tipo) &&
        (!busqueda || [l.documento, l.proveedor, l.descripcion].some((v) => coincide(v, busqueda))),
    )
    .map((linea) => ({ linea, coincide: linea.idsInsumoOkima.includes(solicitud?.id_insumo_okima) }))
  return filas.sort((a, b) => {
    if (a.coincide !== b.coincide) return a.coincide ? -1 : 1
    const fa = a.linea.fecha ?? ''
    const fb = b.linea.fecha ?? ''
    return fa === fb ? 0 : fa < fb ? 1 : -1
  })
}
