import { avisaFacturas, boletasDeLineas, facturasDeLineas, textoConfirmacionEstado } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'

const SELECT_FACTURAS = 'id, factura:facturas(numero_factura, fecha, proveedor:proveedores(nombre))'
const SELECT_BOLETAS = 'id, boleta:boletas(id, fecha, numero_documento, lineas:detalle_boletas(descripcion, created_at))'

// Pide confirmación para cambiar a mano el estado de una solicitud. Al pasarla a
// 'Pendiente' o 'Cancelada' (en pantalla, "Anulada") consulta antes qué facturas y
// boletas la referencian y lo incluye en el aviso (no bloquea: el vínculo de la línea
// se mantiene). Una solicitud está vinculada a facturas O a boletas, pero se consultan
// ambas. Un rol que no lee líneas (productor) recibe vacío sin error: sin aviso.
// Devuelve true si el usuario confirmó; lanza el error si una consulta falla.
//
// El cambio manual persiste: el trigger marcar_solicitud_comprada solo vuelve a
// poner 'Comprada' cuando una línea de factura o de boleta se inserta con la solicitud o
// cambia su id_solicitud_compra (Facturas y Boletas envían solo los campos cambiados,
// ver diffLineas), no al editar otras columnas de la línea.
export async function confirmarCambioEstado(solicitud, nuevoEstado) {
  let facturas = []
  let boletas = []
  if (avisaFacturas(nuevoEstado)) {
    const consultar = (tabla, select) => supabase.from(tabla).select(select).eq('id_solicitud_compra', solicitud.id)
    const [resFacturas, resBoletas] = await Promise.all([
      consultar('detalle_facturas', SELECT_FACTURAS),
      consultar('detalle_boletas', SELECT_BOLETAS),
    ])
    if (resFacturas.error) throw resFacturas.error
    if (resBoletas.error) throw resBoletas.error
    facturas = facturasDeLineas(resFacturas.data)
    boletas = boletasDeLineas(resBoletas.data)
  }
  return window.confirm(textoConfirmacionEstado(solicitud, nuevoEstado, facturas, boletas))
}
