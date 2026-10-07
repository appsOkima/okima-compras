import { X } from 'lucide-react'
import Combobox from '../../components/Combobox'
import Campo from './Campo'

// Campo opcional "Solicitud de compra" de una línea de factura o de boleta. `opciones`
// ya viene filtrada y ordenada para la línea (ver opcionSolicitud y solicitudesDisponibles).
function CampoSolicitud({ id, opciones, valor, onChange, cargando }) {
  return (
    <Campo id={id} etiqueta="Solicitud de compra" ayuda="Opcional: al guardar, la solicitud pasa a 'Comprada'.">
      <div className="flex items-center gap-2">
        <Combobox
          id={id}
          className="flex-1"
          opciones={opciones}
          valor={valor}
          onChange={onChange}
          placeholder={cargando ? 'Cargando solicitudes…' : 'Sin solicitud (opcional)…'}
          disabled={cargando}
        />
        {valor && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Quitar solicitud"
            title="Quitar solicitud"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </Campo>
  )
}

export default CampoSolicitud
