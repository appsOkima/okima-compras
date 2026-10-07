import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/contexto'
import { useTabla } from '../hooks/useTabla'
import { estaAnulado } from '../lib/anulacion'
import { buscarDuplicados as buscarDuplicadosEn } from '../lib/duplicados'
import { CODIGO_EN_USO, mensajeError } from '../lib/errores'
import { puedeHacer } from '../lib/permisos'
import { coincide } from '../lib/texto'
import DetalleRegistro from './DetalleRegistro'
import FormularioRegistro from './FormularioRegistro'
import Interruptor from './Interruptor'
import Modal from './Modal'
import TablaDatos from './TablaDatos'
import { claseBotonPrimario, claseInput } from './estilos'

// Constante para que el valor por defecto no cambie en cada render.
const BUSQUEDA_POR_DEFECTO = ['nombre']

// Valor de búsqueda de una fila: clave directa o función (ej. nombre de la categoría embebida).
const valorBusqueda = (fila, campo) => (typeof campo === 'function' ? campo(fila) : fila[campo])

const NOMBRE_POR_DEFECTO = (fila) => fila.nombre

// Estructura común de todos los Mantenedores: encabezado, filtros, tabla con CSV
// y formulario modal (o en página propia, ver `rutaFormulario`). Cada pantalla
// solo declara columnas y campos.
// `detalle` (opcional, ver DetalleRegistro) agrega la acción "Ver detalles" para
// consultar campos que no caben en la tabla.
// `entidad` (ver lib/permisos): según el rol del usuario se ocultan Nuevo, Editar y Eliminar.
// Opcionales para tablas sin `nombre` o con más filtros (ej. Boletas):
// - `nombreRegistro(fila)`: texto que identifica la fila en títulos y avisos.
// - `duplicadosPorNombre = false`: sin aviso de parecidos por nombre.
// - `filtroExtra = { render(filas), aplica(fila), activo }`: control propio en la
//   barra (recibe todas las filas cargadas); se aplica antes de búsqueda e Incompletos.
// - `antesDeTabla({ filas, crear })`: contenido entre el encabezado y la tabla.
// - `resumen(filasVisibles)`: línea bajo la tabla (ej. total de lo filtrado).
// - `tieneAnulados` (facturas y boletas): oculta por defecto los documentos anulados, con
//   un interruptor "Mostrar anuladas"; un anulado no se edita (sin botón Editar ni en la ficha).
// - `accionesFila(fila, { actualizar })`: botones extra en cada fila (ej. Anular/Reactivar).
// - `mensajeBorrado(error)`: mensaje propio para un error al borrar (null = el general).
// - `rutaFormulario` (ej. '/proveedores'): crear y editar abren el formulario en su
//   propia página (`${rutaFormulario}/nuevo` y `${rutaFormulario}/:id`, ver
//   PaginaRegistro) en vez del modal; `campos`, `valoresIniciales`, `antesDeGuardar`
//   y lo de duplicados se declaran entonces en esa página. El listado muestra el
//   aviso de éxito que deja la página al guardar (location.state.mensaje).
function Mantenedor({
  titulo,
  descripcion,
  entidad,
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
  duplicadosAdicionales,
  etiquetaDuplicado,
  detalle,
  nombreRegistro = NOMBRE_POR_DEFECTO,
  duplicadosPorNombre = true,
  filtroExtra,
  antesDeTabla,
  resumen,
  rutaFormulario,
  tieneAnulados = false,
  accionesFila,
  mensajeBorrado,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil } = useAuth()
  const puedeCrear = puedeHacer(perfil?.rol, entidad, 'crear')
  const puedeEditar = puedeHacer(perfil?.rol, entidad, 'editar')
  const puedeBorrar = puedeHacer(perfil?.rol, entidad, 'borrar')
  const { filas, cargando, error, crear, actualizar, eliminar } = useTabla(tabla, { select, orden })
  const [busqueda, setBusqueda] = useState('')
  const [soloIncompletos, setSoloIncompletos] = useState(false)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false)
  // null = cerrado; { registro: null } = nuevo; { registro } = edición.
  const [edicion, setEdicion] = useState(null)
  // Se guarda el id y no la fila para mostrar siempre los datos recargados;
  // si el registro desaparece, la ficha se cierra sola.
  const [idDetalle, setIdDetalle] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  // Aviso de éxito que deja la página del formulario al guardar (solo con rutaFormulario).
  const [aviso, setAviso] = useState(() => (rutaFormulario && location.state?.mensaje) || '')

  // Se limpia el state del historial para que el aviso no reaparezca al recargar.
  useEffect(() => {
    if (rutaFormulario && location.state?.mensaje) navigate(location.pathname, { replace: true, state: null })
  }, [rutaFormulario, location, navigate])

  const totalAnuladas = useMemo(() => (tieneAnulados ? filas.filter(estaAnulado).length : 0), [filas, tieneAnulados])
  const filaDetalle = idDetalle ? filas.find((f) => f.id === idDetalle) : null

  const aplicaFiltroExtra = filtroExtra?.aplica
  const filasActivas = useMemo(
    () =>
      filas.filter(
        (f) =>
          (!tieneActivo || mostrarInactivos || f.activo !== false) &&
          (!tieneAnulados || mostrarAnuladas || !estaAnulado(f)) &&
          (!aplicaFiltroExtra || aplicaFiltroExtra(f)),
      ),
    [filas, tieneActivo, mostrarInactivos, tieneAnulados, mostrarAnuladas, aplicaFiltroExtra],
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

  // Parecidos entre las filas cargadas, sin el propio registro (ver lib/duplicados).
  const buscarDuplicados = (valores) =>
    buscarDuplicadosEn({ valores, filas, registro, filtroDuplicados, duplicadosAdicionales, duplicadosPorNombre })

  // Con rutaFormulario se navega a la página del formulario; si no, se abre el modal.
  const abrirNuevo = () => (rutaFormulario ? navigate(`${rutaFormulario}/nuevo`) : setEdicion({ registro: null }))
  const abrirEdicion = (fila) =>
    rutaFormulario ? navigate(`${rutaFormulario}/${fila.id}`) : setEdicion({ registro: fila })

  const guardar = async (valores) => {
    const datos = antesDeGuardar ? antesDeGuardar(valores, registro) : valores
    if (registro) await actualizar(registro.id, datos)
    else await crear(datos)
    setEdicion(null)
  }

  const borrar = async (fila) => {
    if (!window.confirm(`¿Eliminar "${nombreRegistro(fila) ?? 'este registro'}"? Esta acción no se puede deshacer.`)) return
    setErrorAccion('')
    try {
      await eliminar(fila.id)
    } catch (e) {
      const sugerencia = e?.code === CODIGO_EN_USO && tieneActivo ? ' Puedes desactivarlo en su lugar.' : ''
      setErrorAccion(mensajeBorrado?.(e) ?? mensajeError(e) + sugerencia)
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
      {filtroExtra?.render(filas)}
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
      {tieneAnulados && (
        <Interruptor activo={mostrarAnuladas} onCambiar={setMostrarAnuladas}>
          Mostrar anuladas
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              totalAnuladas > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {totalAnuladas}
          </span>
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
        {puedeCrear && (
          <button type="button" onClick={abrirNuevo} className={`${claseBotonPrimario} print:hidden`}>
            <Plus className="h-4 w-4" />
            Nuevo
          </button>
        )}
      </div>

      {aviso && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{aviso}</p>
          <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {antesDeTabla?.({ filas, crear })}

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={filasVisibles}
          nombreArchivo={nombreArchivo}
          cargando={cargando}
          error={error}
          vacio={
            busqueda || soloIncompletos || filtroExtra?.activo
              ? 'Ningún registro coincide con los filtros.'
              : 'Todavía no hay registros.'
          }
          barra={barra}
          claseFila={tieneAnulados ? (fila) => (estaAnulado(fila) ? 'opacity-60' : '') : undefined}
          acciones={(fila) => (
            <div className="inline-flex gap-1">
              {detalle && (
                <button
                  type="button"
                  onClick={() => setIdDetalle(fila.id)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                  aria-label={`Ver detalles de ${nombreRegistro(fila) ?? ''}`}
                  title="Ver detalles"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              {puedeEditar && !(tieneAnulados && estaAnulado(fila)) && (
                <button
                  type="button"
                  onClick={() => abrirEdicion(fila)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                  aria-label={`Editar ${nombreRegistro(fila) ?? ''}`}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {accionesFila?.(fila, { actualizar })}
              {puedeBorrar && (
                <button
                  type="button"
                  onClick={() => borrar(fila)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Eliminar ${nombreRegistro(fila) ?? ''}`}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        />
        {resumen && !cargando && !error && <div className="mt-2 text-right text-sm text-slate-600">{resumen(filasVisibles)}</div>}
      </div>

      {detalle && filaDetalle && (
        <Modal titulo={nombreRegistro(filaDetalle) ?? 'Detalles'} onCerrar={() => setIdDetalle(null)}>
          <DetalleRegistro
            detalle={detalle}
            fila={filaDetalle}
            onEditar={
              !puedeEditar || (tieneAnulados && estaAnulado(filaDetalle))
                ? undefined
                : () => {
                    setIdDetalle(null)
                    abrirEdicion(filaDetalle)
                  }
            }
            onCerrar={() => setIdDetalle(null)}
          />
        </Modal>
      )}

      {edicion && !rutaFormulario && (
        <Modal
          titulo={registro ? `Editar: ${nombreRegistro(registro) ?? ''}` : `Nuevo registro — ${titulo}`}
          onCerrar={() => setEdicion(null)}
        >
          <FormularioRegistro
            // key: al cambiar de registro el formulario parte con sus valores.
            key={registro?.id ?? 'nuevo'}
            campos={camposFormulario}
            valoresIniciales={registro ?? valoresIniciales}
            onGuardar={guardar}
            onCancelar={() => setEdicion(null)}
            buscarDuplicados={duplicadosPorNombre || duplicadosAdicionales ? buscarDuplicados : undefined}
            etiquetaDuplicado={etiquetaDuplicado}
          />
        </Modal>
      )}
    </section>
  )
}

export default Mantenedor
