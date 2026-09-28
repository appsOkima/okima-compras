import { useMemo, useState } from 'react'
import { AlertCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useTabla } from '../hooks/useTabla'
import { CODIGO_EN_USO, mensajeError } from '../lib/errores'
import { buscarSimilares, coincide, normalizar } from '../lib/texto'
import FormularioRegistro from './FormularioRegistro'
import Modal from './Modal'
import TablaDatos from './TablaDatos'
import { claseBotonPrimario, claseInput } from './estilos'

// Constante para que el valor por defecto no cambie en cada render.
const BUSQUEDA_POR_DEFECTO = ['nombre']

// Valor de búsqueda de una fila: clave directa o función (ej. nombre de la categoría embebida).
const valorBusqueda = (fila, campo) => (typeof campo === 'function' ? campo(fila) : fila[campo])

// Estructura común de todos los Mantenedores: encabezado, filtros, tabla con CSV
// y formulario modal. Cada pantalla solo declara columnas y campos.
function Mantenedor({
  titulo,
  descripcion,
  tabla,
  select,
  orden,
  columnas,
  campos,
  valoresIniciales = {},
  esIncompleto,
  camposBusqueda = BUSQUEDA_POR_DEFECTO,
  nombreArchivo,
  antesDeGuardar,
  tieneActivo = false,
  filtroDuplicados,
  etiquetaDuplicado,
}) {
  const { filas, cargando, error, crear, actualizar, eliminar } = useTabla(tabla, { select, orden })
  const [busqueda, setBusqueda] = useState('')
  const [soloIncompletos, setSoloIncompletos] = useState(false)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  // null = cerrado; { registro: null } = nuevo; { registro } = edición.
  const [edicion, setEdicion] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')

  const filasActivas = useMemo(
    () => (tieneActivo && !mostrarInactivos ? filas.filter((f) => f.activo !== false) : filas),
    [filas, tieneActivo, mostrarInactivos],
  )
  const totalIncompletos = useMemo(
    () => (esIncompleto ? filasActivas.filter(esIncompleto).length : 0),
    [filasActivas, esIncompleto],
  )
  const filasVisibles = useMemo(
    () =>
      filasActivas.filter(
        (fila) =>
          (!soloIncompletos || !esIncompleto || esIncompleto(fila)) &&
          (!busqueda || camposBusqueda.some((campo) => coincide(valorBusqueda(fila, campo), busqueda))),
      ),
    [filasActivas, soloIncompletos, esIncompleto, busqueda, camposBusqueda],
  )

  const registro = edicion?.registro ?? null
  const camposFormulario = typeof campos === 'function' ? campos(registro) : campos

  // Parecidos por nombre entre las filas cargadas (incluidas las inactivas), sin el
  // propio registro. Al editar solo se avisa si cambió el nombre o su ámbito.
  const buscarDuplicados = (valores) => {
    if (registro) {
      const mismoNombre = normalizar(valores.nombre) === normalizar(registro.nombre)
      const mismoAmbito = !filtroDuplicados || filtroDuplicados(registro, valores)
      if (mismoNombre && mismoAmbito) return []
    }
    const candidatos = filas.filter(
      (f) => f.id !== registro?.id && (!filtroDuplicados || filtroDuplicados(f, valores)),
    )
    return buscarSimilares(valores.nombre, candidatos)
  }

  const guardar = async (valores) => {
    const datos = antesDeGuardar ? antesDeGuardar(valores, registro) : valores
    if (registro) await actualizar(registro.id, datos)
    else await crear(datos)
    setEdicion(null)
  }

  const borrar = async (fila) => {
    if (!window.confirm(`¿Eliminar "${fila.nombre ?? 'este registro'}"? Esta acción no se puede deshacer.`)) return
    setErrorAccion('')
    try {
      await eliminar(fila.id)
    } catch (e) {
      const sugerencia = e?.code === CODIGO_EN_USO && tieneActivo ? ' Puedes desactivarlo en su lugar.' : ''
      setErrorAccion(mensajeError(e) + sugerencia)
    }
  }

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar…"
          aria-label={`Buscar en ${titulo}`}
          className={`${claseInput} pl-9`}
        />
      </div>
      {esIncompleto && (
        <Interruptor activo={soloIncompletos} onCambiar={setSoloIncompletos}>
          Incompletos
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              totalIncompletos > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {totalIncompletos}
          </span>
        </Interruptor>
      )}
      {tieneActivo && (
        <Interruptor activo={mostrarInactivos} onCambiar={setMostrarInactivos}>
          Mostrar inactivos
        </Interruptor>
      )}
    </>
  )

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{titulo}</h2>
          {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}
        </div>
        <button type="button" onClick={() => setEdicion({ registro: null })} className={`${claseBotonPrimario} print:hidden`}>
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {errorAccion && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
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
          filas={filasVisibles}
          nombreArchivo={nombreArchivo}
          cargando={cargando}
          error={error}
          vacio={busqueda || soloIncompletos ? 'Ningún registro coincide con los filtros.' : 'Todavía no hay registros.'}
          barra={barra}
          acciones={(fila) => (
            <div className="inline-flex gap-1">
              <button
                type="button"
                onClick={() => setEdicion({ registro: fila })}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Editar ${fila.nombre ?? ''}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => borrar(fila)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar ${fila.nombre ?? ''}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
      </div>

      {edicion && (
        <Modal titulo={registro ? `Editar: ${registro.nombre ?? ''}` : `Nuevo registro — ${titulo}`} onCerrar={() => setEdicion(null)}>
          <FormularioRegistro
            // key: al cambiar de registro el formulario parte con sus valores.
            key={registro?.id ?? 'nuevo'}
            campos={camposFormulario}
            valoresIniciales={registro ?? valoresIniciales}
            onGuardar={guardar}
            onCancelar={() => setEdicion(null)}
            buscarDuplicados={buscarDuplicados}
            etiquetaDuplicado={etiquetaDuplicado}
          />
        </Modal>
      )}
    </section>
  )
}

// Botón de filtro tipo interruptor (aria-pressed), igual en todos los Mantenedores.
function Interruptor({ activo, onCambiar, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onCambiar(!activo)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
        activo
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export default Mantenedor
