import { errorSinFilas } from '../../lib/errores'
import { supabase } from '../../lib/supabase'

// Vincula (o, con `idSolicitud` null, desvincula) una línea YA GUARDADA de factura
// ('detalle_facturas') o de boleta ('detalle_boletas') con una solicitud. Solo toca
// id_solicitud_compra: no suma stock ni propone vincular el insumo (no es retroactivo).
// Lanza el error de Supabase; un UPDATE denegado por el RLS (0 filas) también es error.
// La base rechaza (23514) vincular una solicitud que ya tiene líneas del otro tipo; el
// trigger de la base la marca 'Comprada'.
export async function vincularLinea(tabla, idLinea, idSolicitud) {
  const { data, error } = await supabase
    .from(tabla)
    .update({ id_solicitud_compra: idSolicitud })
    .eq('id', idLinea)
    .select('id')
  const fallo = error ?? errorSinFilas(data)
  if (fallo) throw fallo
}
