import { avisaFacturas, facturasDeLineas, textoConfirmacionEstado } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'

const SELECT_LINEAS = 'id, factura:facturas(numero_factura, fecha, proveedor:proveedores(nombre))'

// Pide confirmación para cambiar a mano el estado de una solicitud. Al pasarla a
// 'Pendiente' o 'Cancelada' consulta antes qué facturas la referencian y lo
// incluye en el aviso (no bloquea: el vínculo de la línea se mantiene).
// Devuelve true si el usuario confirmó; lanza el error si la consulta falla.
//
// El cambio manual persiste: el trigger marcar_solicitud_comprada solo vuelve a
// poner 'Comprada' cuando una línea de factura se inserta con la solicitud o
// cambia su id_solicitud_compra (Facturas envía solo los campos cambiados, ver
// diffLineas), no al editar otras columnas de la línea.
export async function confirmarCambioEstado(solicitud, nuevoEstado) {
  let facturas = []
  if (avisaFacturas(nuevoEstado)) {
    const { data, error } = await supabase
      .from('detalle_facturas')
      .select(SELECT_LINEAS)
      .eq('id_solicitud_compra', solicitud.id)
    if (error) throw error
    facturas = facturasDeLineas(data)
  }
  return window.confirm(textoConfirmacionEstado(solicitud, nuevoEstado, facturas))
}
