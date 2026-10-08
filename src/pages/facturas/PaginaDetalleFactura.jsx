import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PaginaDetalleDocumento from '../../components/PaginaDetalleDocumento'
import Notas from '../../components/Notas'
import PanelPagos from '../../components/PanelPagos'
import TablaDatos from '../../components/TablaDatos'
import { claseTarjeta } from '../../components/estilos'
import { useAuth } from '../../auth/contexto'
import { useEstadosPago } from '../../hooks/useEstadosPago'
import { estaAnulado } from '../../lib/anulacion'
import { solicitudesDeFactura } from '../../lib/cargarSolicitudes'
import { errorSinFilas } from '../../lib/errores'
import { formatoCLP, formatoCompra, formatoFecha, formatoFechaLocal, formatoNumero } from '../../lib/formato'
import { puedeHacer } from '../../lib/permisos'
import { supabase } from '../../lib/supabase'
import { textoMovimientos } from '../../lib/vinculos'

// Factura con sus líneas en una sola consulta. perfil_anulo: quién la anuló (la FK
// anulado_por se nombra para no confundirla con created_by).
// !id_solicitud_compra: nombra la FK para que el embebido no sea ambiguo.
// movimientos: el stock que aplicó el trigger a cada insumo Okima (puede ser más de uno).
const SELECT_FACTURA =
  '*, proveedor:proveedores(id, nombre, rut), perfil_anulo:perfiles!anulado_por(nombre_mostrar), ' +
  'lineas:detalle_facturas(id, created_at, cantidad, precio_neto, descuento_pct, subtotal, insumo_proveedor:insumos_proveedores(nombre, codigo, cantidad_formato, formato_unidad), movimientos:movimientos_stock(qty, revertido, insumo:insumos(nombre)), solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre)))'

const nombreInsumoProveedor = (l) => l.insumo_proveedor?.nombre ?? ''
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
  { clave: 'solicitud', titulo: 'Solicitud', render: textoSolicitud, csv: textoSolicitud },
]

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children === null || children === undefined || children === '' ? '—' : children}</dd>
    </div>
  )
}

// /facturas/:id/detalle: "Ver detalles" de una factura en pantalla completa (antes una
// modal): datos y totales, líneas y Cuotas/Pagos. Anular/reactivar y los pagos recargan
// la página sin salir de ella.
function PaginaDetalleFactura() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const { estados, recargar: recargarEstados } = useEstadosPago('factura')
  // 'cargando' | 'lista' | 'no-encontrada' | 'error'
  const [carga, setCarga] = useState('cargando')
  const [errorCarga, setErrorCarga] = useState(null)
  const [factura, setFactura] = useState(null)
  // Cada cambio de `version` repite la consulta (tras anular o reactivar).
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    supabase
      .from('facturas')
      .select(SELECT_FACTURA)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error || !data) {
          // 22P02: el id de la URL no es un uuid válido.
          setCarga(!error || error.code === '22P02' ? 'no-encontrada' : 'error')
          setErrorCarga(error)
          return
        }
        setFactura({ ...data, lineas: [...(data.lineas ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) })
        setCarga('lista')
      })
    return () => {
      vigente = false
    }
  }, [id, version])

  const cambiarEstado = useCallback(
    async (datos) => {
      const { data, error } = await supabase.from('facturas').update(datos).eq('id', id).select('id')
      const fallo = error ?? errorSinFilas(data)
      if (fallo) throw fallo
      setVersion((v) => v + 1)
      recargarEstados()
    },
    [id, recargarEstados],
  )

  const puedeEditar = puedeHacer(perfil?.rol, 'facturas', 'editar')

  return (
    <PaginaDetalleDocumento
      tipo="factura"
      rutaListado="/facturas"
      carga={carga}
      errorCarga={errorCarga}
      doc={factura}
      titulo={factura && `Factura N° ${factura.numero_factura} — ${factura.proveedor?.nombre ?? ''}`}
      nombre={factura && `N° ${factura.numero_factura}`}
      estadoPago={estados.get(id)}
      rutaEditar={puedeEditar && factura && !estaAnulado(factura) ? `/facturas/${id}` : undefined}
      onCambiar={cambiarEstado}
      cargarSolicitudes={solicitudesDeFactura}
    >
      {factura && (
        <>
          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Datos de la factura</h3>
            <div className="space-y-4">
              <Notas valor={factura.notas} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                <Dato etiqueta="Proveedor">{factura.proveedor?.nombre}</Dato>
                <Dato etiqueta="RUT">{factura.proveedor?.rut}</Dato>
                <Dato etiqueta="N° factura">{factura.numero_factura}</Dato>
                <Dato etiqueta="Fecha">{formatoFecha(factura.fecha)}</Dato>
                <Dato etiqueta="Descuento de la factura">{porcentaje(factura.descuento_pct)}</Dato>
                <Dato etiqueta="Neto">{formatoCLP(factura.neto_total)}</Dato>
                <Dato etiqueta="IVA 19 %">{formatoCLP(factura.iva)}</Dato>
                <Dato etiqueta="Total">
                  <span className="font-semibold">{formatoCLP(factura.total)}</span>
                </Dato>
                <Dato etiqueta="Ingresada">{formatoFechaLocal(factura.created_at)}</Dato>
              </dl>
            </div>
          </div>

          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Líneas <span className="font-normal normal-case text-slate-400">({factura.lineas.length})</span>
            </h3>
            <TablaDatos
              columnas={columnasLineas}
              filas={factura.lineas}
              nombreArchivo={`factura-${factura.numero_factura}`}
              cargando={false}
              error={null}
              vacio="La factura no tiene líneas."
            />
          </div>

          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cuotas / Pagos</h3>
            <PanelPagos tipo="factura" documento={factura} onCambio={recargarEstados} />
          </div>
        </>
      )}
    </PaginaDetalleDocumento>
  )
}

export default PaginaDetalleFactura
