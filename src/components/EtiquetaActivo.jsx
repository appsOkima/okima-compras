// Pastilla Activo/Inactivo para las columnas `activo` de los Mantenedores.
function EtiquetaActivo({ activo }) {
  return activo ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Inactivo</span>
  )
}

export default EtiquetaActivo
