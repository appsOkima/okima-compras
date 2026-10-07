// Interruptor "Pagado al contado" de las cabeceras de factura y boleta nuevas
// (role="switch" sobre un botón, con el texto como etiqueta accesible).
function SwitchPagoContado({ activo, onCambiar }) {
  return (
    <div className="sm:col-span-2 lg:col-span-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-labelledby="pago-contado-etiqueta"
          aria-describedby="pago-contado-ayuda"
          onClick={() => onCambiar(!activo)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
            activo ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              activo ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span id="pago-contado-etiqueta" className="text-sm font-medium text-slate-700">
          Pagado al contado
        </span>
      </div>
      <p id="pago-contado-ayuda" className="mt-1 text-xs text-slate-500">
        Si lo desmarcas, queda pendiente y registras las cuotas desde Cuotas/Pagos.
      </p>
    </div>
  )
}

export default SwitchPagoContado
