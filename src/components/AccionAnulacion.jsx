import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Ban, Loader2, RotateCcw } from 'lucide-react'
import { useAuth } from '../auth/contexto'
import { estaAnulado, motivoValido, resumenAnulacion, solicitudesVinculadas } from '../lib/anulacion'
import { mensajeError } from '../lib/errores'
import { puedeAnular, puedeReactivar } from '../lib/permisos'
import Modal from './Modal'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from './estilos'

// Botón de la fila para anular (contador y admin) o reactivar (solo admin) una factura o
// boleta; abre el diálogo de confirmación. La base revierte o reaplica el stock y fija
// quién/cuándo anuló: aquí solo se envía el cambio de estado (y el motivo al anular).
// - `tipo`: 'factura' | 'boleta'; `doc`: la fila; `nombre`: cómo se llama en los mensajes.
// - `onCambiar(datos)`: guarda los campos en la cabecera (useTabla.actualizar) y lanza el error.
// - `cargarSolicitudes(idDocumento)` (opcional, async; función estable): líneas con su solicitud vinculada, para avisar
//   antes de anular (facturas y boletas).
// - `conTexto` (opcional): botón con texto ("Anular" / "Reactivar") para la página de detalle,
//   en vez del botón de solo icono de la fila; el diálogo es el mismo.
function AccionAnulacion({ tipo, doc, nombre, onCambiar, cargarSolicitudes, conTexto = false }) {
  const { perfil } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const anulado = estaAnulado(doc)

  if (anulado ? !puedeReactivar(perfil?.rol) : !puedeAnular(perfil?.rol)) return null

  const Icono = anulado ? RotateCcw : Ban
  const accion = anulado ? 'Reactivar' : 'Anular'
  return (
    <>
      {conTexto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={`${claseBotonSecundario} ${anulado ? 'hover:text-emerald-700' : 'text-red-700 hover:text-red-800'}`}
        >
          <Icono className="h-4 w-4" />
          {accion}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className={`rounded-md p-1.5 text-slate-500 ${anulado ? 'hover:bg-emerald-50 hover:text-emerald-700' : 'hover:bg-red-50 hover:text-red-600'}`}
          aria-label={`${accion} la ${tipo} ${nombre}`}
          title={accion}
        >
          <Icono className="h-4 w-4" />
        </button>
      )}
      {abierto && (
        <Modal titulo={`${accion} ${tipo}: ${nombre}`} onCerrar={() => setAbierto(false)}>
          <DialogoAnulacion
            tipo={tipo}
            anulado={anulado}
            idDocumento={doc.id}
            onCambiar={onCambiar}
            cargarSolicitudes={cargarSolicitudes}
            onCerrar={() => setAbierto(false)}
          />
        </Modal>
      )}
    </>
  )
}

const claseBotonAnular =
  'inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'

function DialogoAnulacion({ tipo, anulado, idDocumento, onCambiar, cargarSolicitudes, onCerrar }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  // Solicitudes vinculadas a las líneas (solo al anular y si el documento las tiene).
  const [solicitudes, setSolicitudes] = useState({ cargando: !anulado && !!cargarSolicitudes, lista: [], error: '' })

  useEffect(() => {
    if (anulado || !cargarSolicitudes) return undefined
    let vigente = true
    cargarSolicitudes(idDocumento)
      .then((lineas) => vigente && setSolicitudes({ cargando: false, lista: solicitudesVinculadas(lineas), error: '' }))
      .catch((e) => vigente && setSolicitudes({ cargando: false, lista: [], error: mensajeError(e) }))
    return () => {
      vigente = false
    }
  }, [anulado, idDocumento, cargarSolicitudes])

  const confirmar = async (e) => {
    e.preventDefault()
    if (!anulado && !motivoValido(motivo)) {
      setError('Escribe el motivo de la anulación.')
      return
    }
    setError('')
    setEnviando(true)
    try {
      await onCambiar(
        anulado ? { estado_documento: 'vigente' } : { estado_documento: 'anulado', motivo_anulacion: motivo.trim() },
      )
      onCerrar()
    } catch (excepcion) {
      setError(mensajeError(excepcion))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={confirmar} noValidate className="space-y-4">
      <p className="text-sm text-slate-700">{resumenAnulacion(tipo, anulado ? 'reactivar' : 'anular')}</p>

      {!anulado && (
        <label className="block text-sm font-medium text-slate-700">
          Motivo de la anulación <span className="text-red-600">*</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className={`${claseInput} mt-1`}
            placeholder="Ej.: factura duplicada, error de digitación…"
          />
        </label>
      )}

      {!anulado && solicitudes.cargando && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando solicitudes vinculadas…
        </p>
      )}
      {!anulado && solicitudes.error && (
        <p className="text-sm text-amber-800">No se pudieron revisar las solicitudes vinculadas: {solicitudes.error}</p>
      )}
      {!anulado && solicitudes.lista.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Hay solicitudes de compra vinculadas a sus líneas:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-10">
            {solicitudes.lista.map((texto) => (
              <li key={texto}>{texto}</li>
            ))}
          </ul>
          <p className="mt-1">Siguen con su estado actual y el vínculo se mantiene; revísalas a mano si corresponde.</p>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando}
          className={anulado ? claseBotonPrimario : claseBotonAnular}
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : anulado ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
          {anulado ? 'Reactivar' : 'Anular'}
        </button>
      </div>
    </form>
  )
}

export default AccionAnulacion
