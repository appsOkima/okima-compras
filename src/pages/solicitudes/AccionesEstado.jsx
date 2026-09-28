import { Ban, CircleCheck, RotateCcw } from 'lucide-react'
import { accionEstado, transicionesDisponibles } from '../../lib/solicitudes'

const ICONOS = {
  Pendiente: { Icono: RotateCcw, clase: 'hover:bg-sky-50 hover:text-sky-700' },
  Comprada: { Icono: CircleCheck, clase: 'hover:bg-emerald-50 hover:text-emerald-700' },
  Cancelada: { Icono: Ban, clase: 'hover:bg-red-50 hover:text-red-600' },
}

// Botones para pasar la solicitud a cada uno de los otros estados. La
// confirmación y el guardado los resuelve la lista (`onCambiar(nuevoEstado)`).
function AccionesEstado({ estado, nombre, onCambiar, deshabilitado = false }) {
  return transicionesDisponibles(estado).map((nuevo) => {
    const { Icono, clase } = ICONOS[nuevo] ?? ICONOS.Pendiente
    const accion = accionEstado(nuevo)
    return (
      <button
        key={nuevo}
        type="button"
        onClick={() => onCambiar(nuevo)}
        disabled={deshabilitado}
        className={`rounded-md p-1.5 text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 ${clase}`}
        aria-label={`${accion}: ${nombre}`}
        title={accion}
      >
        <Icono className="h-4 w-4" />
      </button>
    )
  })
}

export default AccionesEstado
