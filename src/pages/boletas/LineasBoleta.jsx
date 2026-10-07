import { useEffect, useState } from 'react'
import TablaDatos from '../../components/TablaDatos'
import { formatoCLP, formatoNumero } from '../../lib/formato'
import { supabase } from '../../lib/supabase'
import { textoMovimientos } from '../../lib/vinculos'

// movimientos: el stock que aplicó el trigger a cada insumo Okima (puede ser más de uno).
const SELECT_LINEAS =
  'id, created_at, descripcion, cantidad, precio, subtotal, insumo_proveedor:insumos_proveedores(nombre, codigo), movimientos:movimientos_stock(qty, revertido, insumo:insumos(nombre))'

const nombreInsumoProveedor = (l) => l.insumo_proveedor?.nombre ?? ''

const columnas = [
  { clave: 'descripcion', titulo: 'Descripción' },
  {
    clave: 'insumo_proveedor',
    titulo: 'Insumo del proveedor',
    csv: nombreInsumoProveedor,
    render: (l) =>
      nombreInsumoProveedor(l) ? (
        <>
          {nombreInsumoProveedor(l)}
          {l.insumo_proveedor?.codigo && <span className="block text-xs text-slate-500">{l.insumo_proveedor.codigo}</span>}
        </>
      ) : (
        ''
      ),
  },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio', titulo: 'Precio unitario', alinear: 'derecha', render: (l) => formatoCLP(l.precio) },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: (l) => formatoCLP(l.subtotal) },
  {
    clave: 'stock',
    titulo: 'Stock sumado',
    csv: (l) => textoMovimientos(l.movimientos),
    render: (l) =>
      l.movimientos?.length > 0 ? (
        <span>
          {l.movimientos.map((m, i) => (
            <span
              key={i}
              className={`block ${m.revertido ? 'text-slate-400 line-through' : ''}`}
              title={m.revertido ? 'Stock revertido por la anulación del documento' : undefined}
            >
              +{formatoNumero(m.qty)} <span className="text-xs text-slate-500">{m.insumo?.nombre ?? ''}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="text-xs text-slate-400">Sin stock</span>
      ),
  },
]

// Líneas de una boleta para su ficha "Ver detalles" (se consultan al abrir; el
// listado solo trae cuántas son), con el stock que sumó cada una.
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
