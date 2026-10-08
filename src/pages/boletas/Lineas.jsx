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
import { lineaBoletaParaVincular } from '../../lib/vinculacion'
import AccionVinculoLinea from '../facturas/AccionVinculoLinea'

// Solo lo que muestra la tabla o exporta el CSV. !id_solicitud_compra nombra la FK para
// que el embebido no sea ambiguo. De la boleta: la fecha, el estado (marca las anuladas) y,
// para nombrarla en la vinculación rápida (lib/vinculacion), su número y descripciones.
const SELECT =
  'id, id_boleta, created_at, descripcion, cantidad, precio, subtotal, id_solicitud_compra, ' +
  'boleta:boletas(numero_documento, fecha, estado_documento, lineas:detalle_boletas(descripcion, created_at)), ' +
  'solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre))'

const ORDEN_CONSULTA = { columna: 'created_at', ascendente: false }

const fechaBoleta = (l) => l.boleta?.fecha ?? null
const anulada = (l) => l.boleta?.estado_documento === 'anulado'
const textoSolicitud = (l) => (l.solicitud ? `${l.solicitud.insumo?.nombre ?? ''} (${l.solicitud.solicitante})` : '')
const monto = (clave) => (l) => <span className="whitespace-nowrap">{formatoCLP(l[clave])}</span>

// Por fecha de la boleta (más reciente primero) y, dentro de ella, por ingreso.
function compararLineas(a, b) {
  const fa = fechaBoleta(a) ?? ''
  const fb = fechaBoleta(b) ?? ''
  if (fa !== fb) return fa < fb ? 1 : -1
  return String(b.created_at).localeCompare(String(a.created_at))
}

const columnas = [
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (l) => <span className="whitespace-nowrap">{formatoFecha(fechaBoleta(l))}</span>,
    csv: fechaBoleta,
  },
  {
    clave: 'descripcion',
    titulo: 'Descripción',
    render: (l) => (
      <>
        {l.descripcion}
        {anulada(l) && (
          <span className="ml-2">
            <EtiquetaAnulada />
          </span>
        )}
      </>
    ),
  },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio', titulo: 'Precio unitario', alinear: 'derecha', render: monto('precio') },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: monto('subtotal') },
  {
    clave: 'solicitud',
    titulo: 'Solicitud',
    csv: textoSolicitud,
    render: (l) => textoSolicitud(l) || <span className="text-xs text-slate-400">Sin solicitud</span>,
  },
  { clave: 'estado_documento', titulo: 'Estado del documento', soloCsv: true, csv: (l) => l.boleta?.estado_documento ?? '' },
  { clave: 'id_solicitud_compra', titulo: 'ID solicitud', soloCsv: true },
  { clave: 'id_boleta', titulo: 'ID boleta', soloCsv: true },
  { clave: 'id', titulo: 'ID línea', soloCsv: true },
]

// Todas las líneas de boleta (análoga a Líneas de factura). Solo se edita el vínculo con
// la solicitud (vinculación rápida, contador y admin); el resto se corrige editando la boleta.
function Lineas() {
  const { filas, cargando, error, recargar } = useTabla('detalle_boletas', { select: SELECT, orden: ORDEN_CONSULTA })
  const solicitudes = useSolicitudesVinculables('detalle_facturas')
  const { perfil } = useAuth()
  const puedeVincular = puedeHacer(perfil?.rol, 'boletas', 'editar')
  const [busqueda, setBusqueda] = useState('')
  const [mes, setMes] = useState('')
  const [soloSinSolicitud, setSoloSinSolicitud] = useState(false)

  const meses = useMemo(() => mesesPresentes(filas.map((l) => ({ fecha: fechaBoleta(l) }))), [filas])
  const sinSolicitud = useMemo(() => filas.filter((l) => !l.id_solicitud_compra).length, [filas])
  const recargarTodo = () => Promise.all([recargar({ silencioso: true }), solicitudes.recargar({ silencioso: true })])

  const visibles = useMemo(
    () =>
      filas
        .filter(
          (l) =>
            (!mes || mesDe(fechaBoleta(l)) === mes) &&
            (!soloSinSolicitud || !l.id_solicitud_compra) &&
            (!busqueda || coincide(l.descripcion, busqueda)),
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
          placeholder="Buscar descripción…"
          aria-label="Buscar líneas de boleta"
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
        <h2 className="text-xl font-semibold text-slate-800">Líneas de boleta</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todas las líneas de boleta. Para corregir una línea, edita su boleta; aquí solo se vincula o desvincula su
          solicitud.
        </p>
      </div>

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="lineas-boletas"
          cargando={cargando}
          error={error}
          vacio={
            busqueda || mes || soloSinSolicitud ? 'Ninguna línea coincide con los filtros.' : 'Todavía no hay líneas de boleta.'
          }
          barra={barra}
          claseFila={(l) => (anulada(l) ? 'opacity-60' : '')}
          acciones={
            puedeVincular
              ? (l) => (
                  <AccionVinculoLinea
                    linea={lineaBoletaParaVincular(l)}
                    tabla="detalle_boletas"
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
