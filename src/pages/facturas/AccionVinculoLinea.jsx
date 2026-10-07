import { useMemo, useState } from 'react'
import { Link2, Link2Off, Loader2 } from 'lucide-react'
import Combobox from '../../components/Combobox'
import { mensajeError } from '../../lib/errores'
import { ordenarSolicitudesParaLinea } from '../../lib/facturas'
import { opcionSolicitud } from '../../lib/solicitudes'
import { vincularLinea } from './vincularLinea'

const claseEnlace = 'rounded px-2 py-1 text-xs font-medium text-primary-darker hover:bg-primary-50 disabled:opacity-50'

// Acción de fila en las vistas de líneas (Sprint2 §3.3): selector de solicitud + "Vincular"
// para una línea sin solicitud, o "Cambiar" / "Desvincular" si ya tiene. `linea` es la forma
// común de lib/vinculacion; `solicitudes` las pendientes vinculables (ya sin las del otro
// tipo de documento), ordenadas aquí igual que en el modal. Una línea de documento
// anulado no se puede vincular. `onCambio` recarga la tabla y las solicitudes.
function AccionVinculoLinea({ linea, tabla, solicitudes, onCambio }) {
  const [cambiando, setCambiando] = useState(false)
  const [elegida, setElegida] = useState('')
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState('')

  const opciones = useMemo(
    () => ordenarSolicitudesParaLinea(solicitudes, linea.idsInsumoOkima).map((s) => opcionSolicitud(s, linea.idsInsumoOkima)),
    [solicitudes, linea.idsInsumoOkima],
  )

  if (linea.anulado) return <span className="text-xs text-slate-400">Documento anulado</span>

  const aplicar = async (idSolicitud) => {
    setError('')
    setEnCurso(true)
    try {
      await vincularLinea(tabla, linea.id, idSolicitud)
      setCambiando(false)
      setElegida('')
      await onCambio()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setEnCurso(false)
    }
  }

  const desvincular = () => {
    const ok = window.confirm(
      '¿Desvincular esta línea de su solicitud? La solicitud conserva su estado actual (cámbialo desde Solicitudes si corresponde).',
    )
    if (ok) aplicar(null)
  }

  const eligiendo = !linea.idSolicitud || cambiando
  return (
    <div className="inline-flex flex-col items-end gap-1">
      {eligiendo ? (
        <div className="flex items-center gap-1">
          <Combobox
            className="w-56 text-left"
            etiqueta="Solicitud a vincular"
            opciones={opciones}
            valor={elegida}
            onChange={setElegida}
            placeholder="Solicitud…"
            disabled={enCurso}
          />
          <button
            type="button"
            onClick={() => aplicar(elegida)}
            disabled={!elegida || enCurso}
            className="inline-flex items-center gap-1 rounded-md bg-primary-dark px-3 py-2 text-xs font-medium text-white hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCurso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Vincular
          </button>
          {cambiando && (
            <button type="button" onClick={() => setCambiando(false)} disabled={enCurso} className={claseEnlace}>
              Cancelar
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCambiando(true)} disabled={enCurso} className={claseEnlace}>
            Cambiar
          </button>
          <button type="button" onClick={desvincular} disabled={enCurso} className={`${claseEnlace} inline-flex items-center gap-1`}>
            <Link2Off className="h-3.5 w-3.5" />
            Desvincular
          </button>
        </div>
      )}
      {error && (
        <p className="max-w-xs whitespace-normal text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default AccionVinculoLinea
