import { useEffect, useState } from 'react'
import TablaDatos from '../../components/TablaDatos'
import { formatoCLP, formatoNumero } from '../../lib/formato'
import { supabase } from '../../lib/supabase'

// !id_solicitud_compra: nombra la FK para que el embebido no sea ambiguo.
const SELECT_LINEAS =
  'id, created_at, descripcion, cantidad, precio, subtotal, solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre))'

const textoSolicitud = (l) => (l.solicitud ? `${l.solicitud.insumo?.nombre ?? ''} (${l.solicitud.solicitante})` : '')

const columnas = [
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio', titulo: 'Precio unitario', alinear: 'derecha', render: (l) => formatoCLP(l.precio) },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: (l) => formatoCLP(l.subtotal) },
  { clave: 'solicitud', titulo: 'Solicitud', render: textoSolicitud, csv: textoSolicitud },
]

// Líneas de una boleta para su ficha "Ver detalles" (se consultan al abrir; el
// listado solo trae sus descripciones): descripción, cantidad, precio, subtotal y solicitud.
function LineasBoleta({ boleta }) {
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    supabase
      .from('detalle_boletas')
      .select(SELECT_LINEAS)
      .eq('id_boleta', boleta.id)
      .order('created_at')
      .then(({ data, error: errorConsulta }) => {
        if (!vigente) return
        setLineas(data ?? [])
        setError(errorConsulta ?? null)
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [boleta.id])

  return (
    <div className="mt-1">
      <TablaDatos
        columnas={columnas}
        filas={lineas}
        nombreArchivo={`boleta-${boleta.numero_documento || boleta.id}`}
        cargando={cargando}
        error={error}
        vacio="La boleta no tiene líneas."
      />
    </div>
  )
}

export default LineasBoleta
