import { useMemo, useState } from 'react'
import { AlertCircle, Pencil, RotateCcw, Search, X } from 'lucide-react'
import EtiquetaUrgencia from '../../components/EtiquetaUrgencia'
import Modal from '../../components/Modal'
import TablaDatos from '../../components/TablaDatos'
import { claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoFecha, formatoFechaLocal, formatoNumero } from '../../lib/formato'
import { ESTADOS_SOLICITUD, claseEstado } from '../../lib/solicitudes'
import { coincide } from '../../lib/texto'
import FormularioSolicitud from './FormularioSolicitud'

const SELECT = '*, insumo:insumos(id, nombre)'
const ORDEN = { columna: 'created_at', ascendente: false }
const FILTROS = ['Todas', ...ESTADOS_SOLICITUD]

const nombreInsumo = (fila) => fila.insumo?.nombre ?? ''

// Historial completo de solicitudes, de la más nueva a la más antigua. Solo se
// editan las pendientes; una cancelada se puede reactivar. 'Comprada' la pone el
// trigger de facturas, nunca esta pantalla.
function Todas() {
  const { filas, cargando, error, actualizar } = useTabla('solicitudes_compra', { select: SELECT, orden: ORDEN })
  const [filtro, setFiltro] = useState('Todas')
  const [busqueda, setBusqueda] = useState('')
  const [edicion, setEdicion] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')

  const totales = useMemo(() => {
    const cuenta = { Todas: filas.length }
    for (const f of filas) cuenta[f.estado] = (cuenta[f.estado] ?? 0) + 1
    return cuenta
  }, [filas])

  const visibles = useMemo(
    () =>
      filas.filter(
        (f) =>
          (filtro === 'Todas' || f.estado === filtro) &&
          (!busqueda || [nombreInsumo(f), f.solicitante].some((v) => coincide(v, busqueda))),
      ),
    [filas, filtro, busqueda],
  )

  const guardar = async (datos) => {
    await actualizar(edicion.id, datos)
    setEdicion(null)
  }

  const reactivar = async (fila) => {
    if (!window.confirm(`¿Reactivar la solicitud de "${nombreInsumo(fila)}"? Volverá a la lista de pendientes.`)) return
    setErrorAccion('')
    try {
      await actualizar(fila.id, { estado: 'Pendiente' })
    } catch (e) {
      setErrorAccion(mensajeError(e))
    }
  }

  const columnas = [
    {
      clave: 'created_at',
      titulo: 'Creada',
      render: (fila) => <span className="whitespace-nowrap">{formatoFechaLocal(fila.created_at)}</span>,
    },
    { clave: 'insumo', titulo: 'Insumo', render: nombreInsumo, csv: nombreInsumo },
    {
      clave: 'cantidad_solicitada',
      titulo: 'Cantidad',
      alinear: 'derecha',
      render: (fila) => formatoNumero(fila.cantidad_solicitada),
    },
    {
      clave: 'nivel_urgencia',
      titulo: 'Urgencia',
      render: (fila) => <EtiquetaUrgencia nivel={fila.nivel_urgencia} />,
    },
    {
      clave: 'fecha_esperada',
      titulo: 'Fecha tope',
      render: (fila) => <span className="whitespace-nowrap">{formatoFecha(fila.fecha_esperada)}</span>,
    },
    { clave: 'solicitante', titulo: 'Solicitante' },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (fila) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${claseEstado(fila.estado)}`}>
          {fila.estado}
        </span>
      ),
    },
  ]

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar insumo o solicitante…"
          aria-label="Buscar en el historial de solicitudes"
          className={`${claseInput} pl-9`}
        />
      </div>
      <div className="inline-flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={filtro === opcion}
            onClick={() => setFiltro(opcion)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              filtro === opcion
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opcion}
            <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{totales[opcion] ?? 0}</span>
          </button>
        ))}
      </div>
    </>
  )

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Todas las solicitudes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Historial completo. Solo se editan las pendientes; las canceladas se pueden reactivar.
        </p>
      </div>

      {errorAccion && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{errorAccion}</p>
          <button type="button" onClick={() => setErrorAccion('')} aria-label="Cerrar aviso" className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="solicitudes-compra"
          cargando={cargando}
          error={error}
          vacio={busqueda || filtro !== 'Todas' ? 'Ninguna solicitud coincide con los filtros.' : 'Todavía no hay solicitudes.'}
          barra={barra}
          acciones={(fila) =>
            fila.estado === 'Pendiente' ? (
              <button
                type="button"
                onClick={() => setEdicion(fila)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Editar solicitud de ${nombreInsumo(fila)}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : fila.estado === 'Cancelada' ? (
              <button
                type="button"
                onClick={() => reactivar(fila)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-indigo-700"
                title="Volver a Pendiente"
              >
                <RotateCcw className="h-4 w-4" />
                Reactivar
              </button>
            ) : null
          }
        />
      </div>

      {edicion && (
        <Modal titulo={`Editar solicitud: ${nombreInsumo(edicion)}`} onCerrar={() => setEdicion(null)}>
          <FormularioSolicitud
            key={edicion.id}
            registro={edicion}
            onGuardar={guardar}
            onCancelar={() => setEdicion(null)}
          />
        </Modal>
      )}
    </section>
  )
}

export default Todas
