import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { AlertCircle, Pencil, Plus, Printer, Search, X } from 'lucide-react'
import EtiquetaUrgencia from '../../components/EtiquetaUrgencia'
import Modal from '../../components/Modal'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoFecha, formatoFechaLocal, formatoNumero } from '../../lib/formato'
import { compararPendientes, estadoFechaTope, hoyISO, metaUrgencia } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import { coincide } from '../../lib/texto'
import AccionesEstado from './AccionesEstado'
import { confirmarCambioEstado } from './confirmarCambioEstado'
import FormularioSolicitud from './FormularioSolicitud'

// La vista se consulta por su columna de antigüedad (la vista no tiene `nombre`,
// el orden por defecto de useTabla) y se reordena igual que la vista.
const ORDEN_CONSULTA = { columna: 'created_at', ascendente: true }

// Fecha tope: vencida u hoy se destaca en rojo en pantalla, con texto para papel.
function FechaTope({ fecha, hoy }) {
  const estado = estadoFechaTope(fecha, hoy)
  if (estado === 'vencida' || estado === 'hoy') {
    return (
      <span className="whitespace-nowrap font-semibold text-red-700">
        {formatoFecha(fecha)} <span className="text-xs font-medium">({estado})</span>
      </span>
    )
  }
  return <span className="whitespace-nowrap">{formatoFecha(fecha)}</span>
}

// Lista de solicitudes pendientes (vista_solicitudes_pendientes), por urgencia, e
// impresión (skill vista-impresion): en papel queda solo el encabezado y la tabla.
function Pendientes() {
  const { filas, cargando, error, recargar } = useTabla('vista_solicitudes_pendientes', { orden: ORDEN_CONSULTA })
  const [busqueda, setBusqueda] = useState('')
  // null = cerrado; { registro: null } = nueva; { registro } = edición.
  const [edicion, setEdicion] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  // id de la solicitud cuyo estado se está cambiando (evita doble clic).
  const [enCurso, setEnCurso] = useState(null)
  // Momento de impresión: se fija justo antes de imprimir (también con Ctrl+P).
  const [impreso, setImpreso] = useState(() => new Date())

  useEffect(() => {
    // flushSync: el encabezado debe tener la hora nueva antes de que se arme la hoja.
    const antesDeImprimir = () => flushSync(() => setImpreso(new Date()))
    window.addEventListener('beforeprint', antesDeImprimir)
    return () => window.removeEventListener('beforeprint', antesDeImprimir)
  }, [])

  const hoy = hoyISO()
  const visibles = useMemo(
    () =>
      filas
        .filter(
          (f) => !busqueda || [f.insumo_nombre, f.solicitante, f.proveedores_sugeridos].some((v) => coincide(v, busqueda)),
        )
        .sort(compararPendientes),
    [filas, busqueda],
  )

  const guardar = async (datos) => {
    const registro = edicion?.registro
    const { error: errorGuardar } = registro
      ? await supabase.from('solicitudes_compra').update(datos).eq('id', registro.id)
      : await supabase.from('solicitudes_compra').insert(datos)
    if (errorGuardar) throw errorGuardar
    setEdicion(null)
    // Se recarga la vista: trae el nombre del insumo y los proveedores sugeridos.
    await recargar({ silencioso: true })
  }

  // Marcar comprada o cancelar a mano (con confirmación); la fila sale de la lista al recargar.
  const cambiarEstado = async (fila, nuevoEstado) => {
    setErrorAccion('')
    setEnCurso(fila.id)
    try {
      if (!(await confirmarCambioEstado(fila, nuevoEstado))) return
      const { error: errorCambio } = await supabase
        .from('solicitudes_compra')
        .update({ estado: nuevoEstado })
        .eq('id', fila.id)
      if (errorCambio) throw errorCambio
      await recargar({ silencioso: true })
    } catch (e) {
      setErrorAccion(mensajeError(e))
    } finally {
      setEnCurso(null)
    }
  }

  const columnas = [
    {
      clave: 'nivel_urgencia',
      titulo: 'Urgencia',
      render: (fila) => <EtiquetaUrgencia nivel={fila.nivel_urgencia} />,
    },
    { clave: 'insumo_nombre', titulo: 'Insumo', render: (fila) => <span className="font-medium">{fila.insumo_nombre}</span> },
    {
      clave: 'cantidad_solicitada',
      titulo: 'Cantidad',
      alinear: 'derecha',
      render: (fila) => formatoNumero(fila.cantidad_solicitada),
    },
    {
      clave: 'fecha_esperada',
      titulo: 'Fecha tope',
      render: (fila) => <FechaTope fecha={fila.fecha_esperada} hoy={hoy} />,
    },
    { clave: 'solicitante', titulo: 'Solicitante' },
    {
      clave: 'proveedores_sugeridos',
      titulo: 'Proveedores sugeridos',
      render: (fila) => fila.proveedores_sugeridos || <span className="text-slate-400">—</span>,
    },
    {
      clave: 'created_at',
      titulo: 'Creada',
      noImprimir: true,
      render: (fila) => <span className="whitespace-nowrap">{formatoFechaLocal(fila.created_at)}</span>,
    },
  ]

  return (
    <section className="mt-6 print:mt-0">
      {/* Encabezado solo para papel: el de la sección y el menú no se imprimen. */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold text-black">Solicitudes de compra pendientes</h1>
        <p className="text-sm text-black">
          Impreso el {formatoFechaLocal(impreso)} a las{' '}
          {impreso.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {visibles.length}{' '}
          {visibles.length === 1 ? 'solicitud' : 'solicitudes'} · Urgencia: ▲ Alta, ■ Media, ▽ Baja
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Pendientes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ordenadas por urgencia y fecha tope. Pasan a "Comprada" solas al asociarlas a una línea de factura, o
            a mano con "Marcar comprada".
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={cargando || visibles.length === 0}
            className={claseBotonSecundario}
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button type="button" onClick={() => setEdicion({ registro: null })} className={claseBotonPrimario}>
            <Plus className="h-4 w-4" />
            Nueva solicitud
          </button>
        </div>
      </div>

      {errorAccion && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{errorAccion}</p>
          <button type="button" onClick={() => setErrorAccion('')} aria-label="Cerrar aviso" className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4 print:mt-0">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="solicitudes-pendientes"
          cargando={cargando}
          error={error}
          vacio={busqueda ? 'Ninguna solicitud coincide con la búsqueda.' : 'No hay solicitudes pendientes.'}
          claseFila={(fila) => metaUrgencia(fila.nivel_urgencia).claseFila}
          barra={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en solicitudes pendientes"
                className={`${claseInput} pl-9`}
              />
            </div>
          }
          acciones={(fila) => (
            <div className="inline-flex gap-1">
              <button
                type="button"
                onClick={() => setEdicion({ registro: fila })}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Editar solicitud de ${fila.insumo_nombre}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <AccionesEstado
                estado="Pendiente"
                nombre={fila.insumo_nombre}
                deshabilitado={enCurso === fila.id}
                onCambiar={(nuevo) => cambiarEstado(fila, nuevo)}
              />
            </div>
          )}
        />
      </div>

      {edicion && (
        <Modal
          titulo={edicion.registro ? `Editar solicitud: ${edicion.registro.insumo_nombre ?? ''}` : 'Nueva solicitud de compra'}
          onCerrar={() => setEdicion(null)}
        >
          <FormularioSolicitud
            key={edicion.registro?.id ?? 'nueva'}
            registro={edicion.registro}
            onGuardar={guardar}
            onCancelar={() => setEdicion(null)}
          />
        </Modal>
      )}
    </section>
  )
}

export default Pendientes
