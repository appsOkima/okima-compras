import { useCallback, useEffect, useState } from 'react'
import { estadosPorDocumento } from '../lib/pagos'
import { supabase } from '../lib/supabase'

// Estado de pago de todas las facturas ('factura') o boletas ('boleta') en una sola
// consulta a vista_estado_pago (una vista no se puede embeber con PostgREST), indexado
// por id de documento. `recargar` se llama tras cambiar pagos o anular/reactivar.
// Un error no bloquea el listado: la columna "Pago" queda vacía.
export function useEstadosPago(tipo) {
  const [estados, setEstados] = useState(() => new Map())
  // Cada cambio de `version` repite la consulta (ver `recargar`).
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    supabase
      .from('vista_estado_pago')
      .select('id_documento, estado_pago, total, pagado, saldo')
      .eq('tipo', tipo)
      .then(({ data, error }) => {
        if (vigente && !error) setEstados(estadosPorDocumento(data))
      })
    return () => {
      vigente = false
    }
  }, [tipo, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  return { estados, recargar }
}
