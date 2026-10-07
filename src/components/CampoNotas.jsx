import { useId, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { claseInput } from './estilos'

// Campo de notas para formularios que no usan FormularioRegistro (ej. facturas).
// Vacío se contrae a un botón "Agregar nota" para no ocupar espacio; con texto o
// una vez abierto muestra el área de texto. `valor` es texto ('' si no hay).
function CampoNotas({ valor, onChange, etiqueta = 'Notas', className = '' }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)

  if (!abierto && !valor?.trim()) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-darker"
        >
          <StickyNote className="h-3.5 w-3.5" />
          Agregar nota
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <textarea
        id={id}
        rows={2}
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Indicaciones para quien interactúe con este registro"
        className={claseInput}
      />
    </div>
  )
}

export default CampoNotas
