// Pastilla "Anulada" de facturas y boletas anuladas (rojo: no se confunde con Inactivo).
function EtiquetaAnulada() {
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
      Anulada
    </span>
  )
}

export default EtiquetaAnulada
