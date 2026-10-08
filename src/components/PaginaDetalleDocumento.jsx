import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2, Pencil } from 'lucide-react'
import { estaAnulado } from '../lib/anulacion'
import { mensajeError } from '../lib/errores'
import AccionAnulacion from './AccionAnulacion'
import AvisoAnulado from './AvisoAnulado'
import EtiquetaAnulada from './EtiquetaAnulada'
import EtiquetaPago from './EtiquetaPago'
import { claseBotonPrimario } from './estilos'

// Marco de la página de detalle (pantalla completa) de una factura o boleta: "Volver al
// listado", título con sus etiquetas de estado, aviso de anulación y barra de acciones
// (Editar, Anular/Reactivar). El contenido (datos, líneas, pagos) llega como `children`.
// - `tipo`: 'factura' | 'boleta'; `rutaListado`: a dónde vuelve (ej. '/facturas').
// - `carga`: 'cargando' | 'lista' | 'no-encontrada' | 'error' (con `errorCarga`).
// - `doc`: la fila ya cargada; `titulo` y `nombre` (el de los mensajes de anulación).
// - `estadoPago`: fila de vista_estado_pago ({ estado_pago, saldo }), si ya cargó.
// - `rutaEditar`: ruta del formulario; sin ella (rol sin permiso o documento anulado) no hay Editar.
// - `onCambiar(datos)` y `cargarSolicitudes`: como en AccionAnulacion.
function PaginaDetalleDocumento({
  tipo,
  rutaListado,
  carga,
  errorCarga,
  doc,
  titulo,
  nombre,
  estadoPago,
  rutaEditar,
  onCambiar,
  cargarSolicitudes,
  children,
}) {
  const volver = (
    <Link to={rutaListado} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary-darker">
      <ArrowLeft className="h-4 w-4" />
      Volver al listado
    </Link>
  )

  if (carga !== 'lista') {
    return (
      <section className="mx-auto mt-6 max-w-7xl">
        {carga === 'cargando' ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando {tipo}…
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">
              {carga === 'no-encontrada'
                ? `No se encontró la ${tipo} (puede que se haya eliminado).`
                : `No se pudo cargar la ${tipo}: ${mensajeError(errorCarga)}`}{' '}
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
    <section className="mx-auto mt-6 max-w-7xl">
      {volver}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-800">{titulo}</h2>
          {estaAnulado(doc) ? <EtiquetaAnulada /> : <EtiquetaPago fila={estadoPago} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {rutaEditar && (
            <Link to={rutaEditar} className={claseBotonPrimario}>
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          )}
          <AccionAnulacion
            tipo={tipo}
            doc={doc}
            nombre={nombre}
            onCambiar={onCambiar}
            cargarSolicitudes={cargarSolicitudes}
            conTexto
          />
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {estaAnulado(doc) && <AvisoAnulado doc={doc} tipo={tipo} />}
        {children}
      </div>
    </section>
  )
}

export default PaginaDetalleDocumento
