import { useEffect, useState } from 'react'
import DetalleRegistro from '../../components/DetalleRegistro'
import TablaDatos from '../../components/TablaDatos'
import { formatoCLP, formatoCompra, formatoFecha, formatoFechaLocal, formatoNumero } from '../../lib/formato'
import { supabase } from '../../lib/supabase'

// !id_insumo_stock / !id_solicitud_compra: nombra la FK para que el embebido no sea ambiguo.
const SELECT_LINEAS =
  'id, created_at, cantidad, precio_neto, descuento_pct, subtotal, qty_stock, insumo_proveedor:insumos_proveedores(nombre, codigo, cantidad_formato, formato_unidad), insumo_stock:insumos!id_insumo_stock(nombre), solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre))'

const nombreInsumoProveedor = (l) => l.insumo_proveedor?.nombre ?? ''
const nombreInsumoStock = (l) => l.insumo_stock?.nombre ?? ''
const porcentaje = (n) => `${formatoNumero(n ?? 0)} %`
const textoSolicitud = (l) => (l.solicitud ? `${l.solicitud.insumo?.nombre ?? ''} (${l.solicitud.solicitante})` : '')

const columnasLineas = [
  {
    clave: 'insumo_proveedor',
    titulo: 'Insumo del proveedor',
    csv: nombreInsumoProveedor,
    render: (l) => (
      <>
        {nombreInsumoProveedor(l)}
        <span className="block text-xs text-slate-500">
          {[l.insumo_proveedor?.codigo, formatoCompra(l.insumo_proveedor?.cantidad_formato, l.insumo_proveedor?.formato_unidad)]
            .filter((v) => v && v !== '—')
            .join(' · ')}
        </span>
      </>
    ),
  },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio_neto', titulo: 'Precio neto', alinear: 'derecha', render: (l) => formatoCLP(l.precio_neto) },
  { clave: 'descuento_pct', titulo: 'Descuento %', alinear: 'derecha', render: (l) => porcentaje(l.descuento_pct) },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: (l) => formatoCLP(l.subtotal) },
  {
    clave: 'stock',
    titulo: 'Stock sumado',
    csv: (l) => (l.insumo_stock ? `${l.qty_stock} a ${nombreInsumoStock(l)}` : ''),
    render: (l) =>
      l.insumo_stock ? (
        <span>
          {formatoNumero(l.qty_stock)} <span className="text-xs text-slate-500">a {nombreInsumoStock(l)}</span>
        </span>
      ) : (
        <span className="text-xs text-slate-400">Sin stock</span>
      ),
  },
  { clave: 'solicitud', titulo: 'Solicitud', render: textoSolicitud, csv: textoSolicitud },
]

// Contenido de "Ver detalles" de una factura: cabecera, totales y sus líneas
// (se consultan al abrir; el listado solo trae cuántas son).
function DetalleFactura({ factura, onEditar, onCerrar }) {
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    supabase
      .from('detalle_facturas')
      .select(SELECT_LINEAS)
      .eq('id_factura', factura.id)
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
  }, [factura.id])

  const detalle = [
    { etiqueta: 'Proveedor', valor: (f) => f.proveedor?.nombre },
    { etiqueta: 'RUT', valor: (f) => f.proveedor?.rut },
    { etiqueta: 'N° factura', valor: (f) => f.numero_factura },
    { etiqueta: 'Fecha', valor: (f) => formatoFecha(f.fecha) },
    { etiqueta: 'Descuento de la factura', valor: (f) => porcentaje(f.descuento_pct) },
    { etiqueta: 'Neto', valor: (f) => formatoCLP(f.neto_total) },
    { etiqueta: 'IVA 19 %', valor: (f) => formatoCLP(f.iva) },
    { etiqueta: 'Total', valor: (f) => <span className="font-semibold">{formatoCLP(f.total)}</span> },
    { etiqueta: 'Ingresada', valor: (f) => formatoFechaLocal(f.created_at) },
    {
      etiqueta: 'Líneas',
      completo: true,
      valor: (f) => (
        <div className="mt-1">
          <TablaDatos
            columnas={columnasLineas}
            filas={lineas}
            nombreArchivo={`factura-${f.numero_factura}`}
            cargando={cargando}
            error={error}
            vacio="La factura no tiene líneas."
          />
        </div>
      ),
    },
  ]

  return <DetalleRegistro detalle={detalle} fila={factura} onEditar={onEditar} onCerrar={onCerrar} />
}

export default DetalleFactura
