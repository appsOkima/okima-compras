// Botón de filtro tipo interruptor (aria-pressed), igual en todos los listados.
function Interruptor({ activo, onCambiar, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onCambiar(!activo)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
        activo
          ? 'border-primary-300 bg-primary-50 text-primary-darker'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export default Interruptor
