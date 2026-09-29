import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { useConfirmarSalida } from '../hooks/useConfirmarSalida'
import { useTabla } from '../hooks/useTabla'
import { buscarDuplicados as buscarDuplicadosEn } from '../lib/duplicados'
import { mensajeError } from '../lib/errores'
import FormularioRegistro from './FormularioRegistro'

const NOMBRE_POR_DEFECTO = (fila) => fila.nombre

const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

// Formulario de un Mantenedor en página propia (no modal), para registros con
// muchos campos: `${rutaListado}/nuevo` crea y `${rutaListado}/:id` edita. El
// listado es un Mantenedor con `rutaFormulario` y recibe el aviso de éxito al
// guardar (location.state.mensaje), igual que Facturas.
// Recibe la misma configuración que el formulario del Mantenedor (`campos`,
// `valoresIniciales`, `antesDeGuardar`, duplicados, `nombreRegistro`) más:
// - `titulo`: nombre del registro en minúscula para títulos y avisos (ej. 'proveedor').
// - `rutaListado`: a dónde se vuelve al guardar o cancelar (ej. '/proveedores').
// - `descripcion` (opcional): texto bajo el título.
// Carga la tabla completa con useTabla: sirve para encontrar el registro y como
// candidatos del aviso de duplicados, igual que en el listado.
// Con cambios sin guardar, salir de la página (Volver, Cancelar, menú, pestañas,
// atrás del navegador, recargar) pide confirmación (useConfirmarSalida).
function PaginaRegistro({
  titulo,
  descripcion,
  tabla,
  select,
  orden,
  campos,
  valoresIniciales = {},
  rutaListado,
  antesDeGuardar,
  filtroDuplicados,
  duplicadosAdicionales,
  etiquetaDuplicado,
  nombreRegistro = NOMBRE_POR_DEFECTO,
  duplicadosPorNombre = true,
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { filas, cargando, error, crear, actualizar } = useTabla(tabla, { select, orden })
  const contenedor = useRef(null)
  // Primer cambio del usuario en el formulario → hay algo sin guardar.
  const [sucio, setSucio] = useState(false)
  const permitirSalida = useConfirmarSalida(sucio)

  const esNuevo = !id
  const registro = esNuevo ? null : (filas.find((f) => f.id === id) ?? null)
  const camposFormulario = typeof campos === 'function' ? campos(registro) : campos
  // Se espera la carga también al crear: sin las filas el aviso de duplicados no vería nada.
  const listo = !cargando && !error && (esNuevo || registro !== null)

  // Como hacía el modal: al crear, el foco parte en el primer campo.
  useEffect(() => {
    if (!listo || !esNuevo) return
    contenedor.current?.querySelector('input:not([type=hidden]), select, textarea')?.focus()
  }, [listo, esNuevo])

  const buscarDuplicados = (valores) =>
    buscarDuplicadosEn({ valores, filas, registro, filtroDuplicados, duplicadosAdicionales, duplicadosPorNombre })

  const guardar = async (valores) => {
    const datos = antesDeGuardar ? antesDeGuardar(valores, registro) : valores
    const guardado = registro ? await actualizar(registro.id, datos) : await crear(datos)
    const nombre = nombreRegistro(guardado ?? datos)
    // Ya se guardó: la vuelta al listado no pide confirmación.
    permitirSalida()
    navigate(rutaListado, {
      state: {
        mensaje: `${mayuscula(titulo)}${nombre ? ` «${nombre}»` : ''} ${registro ? 'actualizado' : 'creado'}.`,
      },
    })
  }

  // Si hay cambios sin guardar, el bloqueo de useConfirmarSalida pregunta antes.
  const volver = () => navigate(rutaListado)

  if (!listo) {
    return (
      <section className="mt-6">
        {cargando ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">
              {error
                ? `No se pudieron cargar los datos: ${mensajeError(error)}`
                : `No se encontró el ${titulo} (puede que se haya eliminado).`}{' '}
              <Link to={rutaListado} className="font-medium underline">
                Volver al listado
              </Link>
            </p>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={volver}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>
      <h2 className="mt-2 text-xl font-semibold text-slate-800">
        {registro ? `Editar: ${nombreRegistro(registro) ?? ''}` : `Nuevo ${titulo}`}
      </h2>
      {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}

      <div ref={contenedor} className="mt-4 max-w-4xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <FormularioRegistro
          // key: al cambiar de registro (otra ruta) el formulario parte con sus valores.
          key={registro?.id ?? 'nuevo'}
          campos={camposFormulario}
          valoresIniciales={registro ?? valoresIniciales}
          onGuardar={guardar}
          onCancelar={volver}
          buscarDuplicados={duplicadosPorNombre || duplicadosAdicionales ? buscarDuplicados : undefined}
          etiquetaDuplicado={etiquetaDuplicado}
          enColumnas
          onCambio={() => setSucio(true)}
        />
      </div>
    </section>
  )
}

export default PaginaRegistro
