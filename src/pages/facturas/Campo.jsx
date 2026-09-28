// Etiqueta + control + error, igual que en FormularioRegistro, para el
// formulario de facturas (que no usa FormularioRegistro por ser maestro-detalle).
function Campo({ id, etiqueta, requerido = false, error, ayuda, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default Campo
