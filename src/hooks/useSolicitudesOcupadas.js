import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Ids de solicitudes ya vinculadas a líneas de la tabla dada ('detalle_facturas' o
// 'detalle_boletas'): las que no se pueden ofrecer en el otro tipo de documento (ver
// solicitudesDisponibles). Un error o un rol que no lee líneas deja el conjunto vacío:
// la base igual rechaza el vínculo inválido y mensajeError muestra el motivo.
export function useSolicitudesOcupadas(tabla) {
  const [ids, setIds] = useState(() => new Set())

  useEffect(() => {
    let vigente = true
    supabase
      .from(tabla)
      .select('id_solicitud_compra')
      .not('id_solicitud_compra', 'is', null)
      .then(({ data, error }) => {
        if (vigente && !error) setIds(new Set((data ?? []).map((l) => l.id_solicitud_compra)))
      })
    return () => {
      vigente = false
    }
  }, [tabla])

  return ids
}

// Ids de solicitudes que ya tienen alguna línea, de factura o de boleta: las "sueltas" son
// las que no están aquí. Un rol que no lee líneas (productor) recibe un conjunto vacío.
export function useSolicitudesConLineas() {
  const enFacturas = useSolicitudesOcupadas('detalle_facturas')
  const enBoletas = useSolicitudesOcupadas('detalle_boletas')
  return useMemo(() => new Set([...enFacturas, ...enBoletas]), [enFacturas, enBoletas])
}
