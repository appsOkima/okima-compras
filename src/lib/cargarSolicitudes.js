import { supabase } from './supabase'

// Solicitudes vinculadas a las líneas de una factura o boleta, para avisar antes de
// anularla (ver AccionAnulacion). Las usan el listado y la página de detalle.
const solicitudesDe = (tabla, columna) => async (idDocumento) => {
  const { data, error } = await supabase
    .from(tabla)
    .select('solicitud:solicitudes_compra!id_solicitud_compra(id, estado, solicitante, insumo:insumos(nombre))')
    .eq(columna, idDocumento)
    .not('id_solicitud_compra', 'is', null)
  if (error) throw error
  return data
}

export const solicitudesDeFactura = solicitudesDe('detalle_facturas', 'id_factura')
export const solicitudesDeBoleta = solicitudesDe('detalle_boletas', 'id_boleta')
