import { AlertTriangle, Check } from 'lucide-react'
import { cuadra, textoDiferencias } from '../../lib/facturas'

// Pastilla OK / "No cuadra" del listado; el detalle de las diferencias va en el tooltip.
function EtiquetaCuadre({ resultados }) {
  if (cuadra(resultados)) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <Check className="h-3.5 w-3.5" />
        OK
      </span>
    )
  }
  return (
    <span
      title={textoDiferencias(resultados)}
      className="inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      No cuadra
    </span>
  )
}

export default EtiquetaCuadre
