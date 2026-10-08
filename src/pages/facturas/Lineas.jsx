import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../../auth/contexto'
import EtiquetaAnulada from '../../components/EtiquetaAnulada'
import FiltroMes from '../../components/FiltroMes'
import Interruptor from '../../components/Interruptor'
import TablaDatos from '../../components/TablaDatos'
import { claseInput } from '../../components/estilos'
import { useSolicitudesVinculables } from '../../hooks/useSolicitudesVinculables'
import { useTabla } from '../../hooks/useTabla'
import { formatoCLP, formatoFecha, formatoNumero } from '../../lib/formato'
import { mesDe, mesesPresentes } from '../../lib/gastos'
import { puedeHacer } from '../../lib/permisos'
import { coincide } from '../../lib/texto'
import { lineaFacturaParaVincular } from '../../lib/vinculacion'
import AccionVinculoLinea from './AccionVinculoLinea'

// Solo lo que muestra la tabla o exporta el CSV (hay columnas que solo van al CSV). !id_solicitud_compra nombra la FK
// para que el embebido no sea ambiguo. movimientos: el stock que aplicó el trigger
// a cada insumo Okima (puede ser más de uno por línea). Los vínculos del insumo del
// proveedor ordenan las solicitudes de la vinculación rápida; estado_documento marca
// las líneas de facturas anuladas (no se pueden vincular).
const SELECT =
  'id, id_factura, created_at, cantidad, precio_neto, descuento_pct, subtotal, id_solicitud_compra, ' +
  'factura:facturas(numero_factura, fecha, estado_documento, proveedor:proveedores(nombre, rut)), ' +
  'insumo_proveedor:insumos_proveedores(nombre, codigo, cantidad_formato, formato_unidad, vinculos:insumos_proveedores_okima(id_insumo_okima)), ' +
  'movimientos:movimientos_stock(qty, insumo:insumos(nombre)), ' +
  'solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre))'

const ORDEN_CONSULTA = { columna: 'created_at', ascendente: false }

const fechaFactura = (l) => l.factura?.fecha ?? null
const numeroFactura = (l) => l.factura?.numero_factura ?? ''
const anulada = (l) => l.factura?.estado_documento === 'anulado'
const textoSolicitud = (l) => (l.solicitud ? `${l.solicitud.insumo?.nombre ?? ''} (${l.solicitud.solicitante})` : '')
const nombreProveedor = (l) => l.factura?.proveedor?.nombre ?? ''
const nombreInsumoProveedor = (l) => l.insumo_proveedor?.nombre ?? ''
// Varios insumos Okima por línea: se muestran y exportan separados por "; " (la
// cantidad de cada uno, en el mismo orden, en la columna Stock sumado del CSV).
const nombresInsumosOkima = (l) => (l.movimientos ?? []).map((m) => m.insumo?.nombre ?? '').join('; ')
const monto = (clave) => (l) => <span className="whitespace-nowrap">{formatoCLP(l[clave])}</span>

// Por fecha de la factura (más reciente primero) y, dentro de ella, por ingreso.
// Se ordena aquí: la API ordena por columnas propias, no por las de la factura.
function compararLineas(a, b) {
  const fa = fechaFactura(a) ?? ''
  const fb = fechaFactura(b) ?? ''
  if (fa !== fb) return fa < fb ? 1 : -1
  return String(b.created_at).localeCompare(String(a.created_at))
}

const columnas = [
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (l) => (
      <>
        <span className="whitespace-nowrap">{formatoFecha(fechaFactura(l))}</span>
        {anulada(l) && (
          <span className="ml-2">
            <EtiquetaAnulada />
          </span>
        )}
      </>
    ),
    csv: fechaFactura,
  },
  { clave: 'numero_factura', titulo: 'N° factura', soloCsv: true, csv: numeroFactura },
  { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
  { clave: 'rut_proveedor', titulo: 'RUT proveedor', soloCsv: true, csv: (l) => l.factura?.proveedor?.rut ?? '' },
  {
    clave: 'insumo_proveedor',
    titulo: 'Insumo del proveedor',
    csv: nombreInsumoProveedor,
    render: (l) => (
      <>
        {nombreInsumoProveedor(l)}
        {l.insumo_proveedor?.codigo && <span className="block text-xs text-slate-500">{l.insumo_proveedor.codigo}</span>}
      </>
    ),
  },
  { clave: 'codigo', titulo: 'Código proveedor', soloCsv: true, csv: (l) => l.insumo_proveedor?.codigo ?? '' },
  { clave: 'formato_unidad', titulo: 'Formato unidad', soloCsv: true, csv: (l) => l.insumo_proveedor?.formato_unidad ?? '' },
  {
    clave: 'cantidad_formato',
    titulo: 'Cantidad por formato',
    soloCsv: true,
    csv: (l) => l.insumo_proveedor?.cantidad_formato ?? null,
  },
  { clave: 'insumos_okima', titulo: 'Insumo Okima', soloCsv: true, csv: nombresInsumosOkima },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio_neto', titulo: 'Precio neto', alinear: 'derecha', render: monto('precio_neto') },
  { clave: 'descuento_pct', titulo: 'Descuento %', soloCsv: true },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: monto('subtotal') },
  { clave: 'stock_sumado', titulo: 'Stock sumado', soloCsv: true, csv: (l) => (l.movimientos ?? []).map((m) => m.qty).join('; ') },
  {
    clave: 'solicitud',
    titulo: 'Solicitud',
    csv: textoSolicitud,
    render: (l) => textoSolicitud(l) || <span className="text-xs text-slate-400">Sin solicitud</span>,
  },
  { clave: 'estado_documento', titulo: 'Estado del documento', soloCsv: true, csv: (l) => l.factura?.estado_documento ?? '' },
  { clave: 'id_solicitud_compra', titulo: 'ID solicitud', soloCsv: true },
  { clave: 'id_factura', titulo: 'ID factura', soloCsv: true },
  { clave: 'id', titulo: 'ID línea', soloCsv: true },
]

// Todas las líneas de factura: es la exportación pensada para el ERP (el CSV lleva además
// RUT, formato, solicitud e ids). Solo se edita el vínculo con la solicitud (vinculación
// rápida, contador y admin); el resto se corrige editando la factura.
function Lineas() {
  const { filas, cargando, error, recargar } = useTabla('detalle_facturas', { select: SELECT, orden: ORDEN_CONSULTA })
  const solicitudes = useSolicitudesVinculables('detalle_boletas')
  const { perfil } = useAuth()
  const puedeVincular = puedeHacer(perfil?.rol, 'facturas', 'editar')
  const [busqueda, setBusqueda] = useState('')
  const [mes, setMes] = useState('')
  const [soloSinSolicitud, setSoloSinSolicitud] = useState(false)

  const sinSolicitud = useMemo(() => filas.filter((l) => !l.id_solicitud_compra).length, [filas])
  const recargarTodo = () => Promise.all([recargar({ silencioso: true }), solicitudes.recargar({ silencioso: true })])

  const meses = useMemo(() => mesesPresentes(filas.map((l) => ({ fecha: fechaFactura(l) }))), [filas])

  const visibles = useMemo(
    () =>
      filas
        .filter(
          (l) =>
            (!mes || mesDe(fechaFactura(l)) === mes) &&
            (!soloSinSolicitud || !l.id_solicitud_compra) &&
            (!busqueda ||
              [numeroFactura(l), nombreProveedor(l), nombreInsumoProveedor(l), l.insumo_proveedor?.codigo, nombresInsumosOkima(l)].some(
                (v) => coincide(v, busqueda),
              )),
        )
        .sort(compararLineas),
    [filas, mes, busqueda, soloSinSolicitud],
  )

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar factura, proveedor o insumo…"
          aria-label="Buscar líneas de factura"
          className={`${claseInput} pl-9`}
        />
      </div>
      <FiltroMes meses={meses} valor={mes} onChange={setMes} />
      <Interruptor activo={soloSinSolicitud} onCambiar={setSoloSinSolicitud}>
        No vinculadas a solicitudes
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            sinSolicitud > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {sinSolicitud}
        </span>
      </Interruptor>
    </>
  )

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Líneas de factura</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todas las líneas. Para corregir una línea, edita su factura; aquí solo se vincula o desvincula su solicitud.
          Vincular una línea ya guardada no suma stock ni propone vincular su insumo. El CSV incluye además el N° de
          factura, el descuento, el formato, el insumo Okima y el stock sumado.
        </p>
      </div>

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="lineas-facturas"
          cargando={cargando}
          error={error}
          vacio={
            busqueda || mes || soloSinSolicitud ? 'Ninguna línea coincide con los filtros.' : 'Todavía no hay líneas de factura.'
          }
          barra={barra}
          claseFila={(l) => (anulada(l) ? 'opacity-60' : '')}
          acciones={
            puedeVincular
              ? (l) => (
                  <AccionVinculoLinea
                    linea={lineaFacturaParaVincular(l)}
                    tabla="detalle_facturas"
                    solicitudes={solicitudes.solicitudes}
                    onCambio={recargarTodo}
                  />
                )
              : undefined
          }
        />
      </div>
    </section>
  )
}

export default Lineas
