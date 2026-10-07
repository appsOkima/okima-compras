import { useMemo } from 'react'
import { solicitudesDisponibles } from '../lib/solicitudes'
import { useSolicitudesOcupadas } from './useSolicitudesOcupadas'
import { useTabla } from './useTabla'

const SELECT =
  'id, created_at, id_insumo_okima, insumo_nombre, cantidad_solicitada, solicitante, nivel_urgencia, fecha_esperada'
const ORDEN = { columna: 'created_at', ascendente: true }

// Solicitudes pendientes que se pueden vincular a una línea de la tabla dada, para la
// vinculación rápida desde las vistas de líneas: sin las que ya tienen líneas del
// OTRO tipo de documento (`tablaOtroTipo`: 'detalle_boletas' al vincular facturas y al revés).
export function useSolicitudesVinculables(tablaOtroTipo) {
  const ocupadas = useSolicitudesOcupadas(tablaOtroTipo)
  const { filas, cargando, error, recargar } = useTabla('vista_solicitudes_pendientes', { select: SELECT, orden: ORDEN })
  const solicitudes = useMemo(() => solicitudesDisponibles(filas, ocupadas), [filas, ocupadas])
  return { solicitudes, cargando, error, recargar }
}
