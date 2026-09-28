import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { NOMBRES_CUADRE, TOLERANCIA_CUADRE, cuadra } from '../../lib/facturas'
import { formatoCLP } from '../../lib/formato'

// Cuadre en vivo de los totales escritos contra las líneas (ver evaluarCuadre).
// Solo avisa: una factura que no cuadra se puede guardar igual.
function PanelCuadre({ resultados, suma }) {
  const ok = cuadra(resultados)
  return (
    <div
      className={`rounded-md border p-3 text-sm ${ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50'}`}
      aria-live="polite"
    >
      <p className={`flex items-center gap-2 font-medium ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
        {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        {ok ? 'Los totales cuadran con las líneas' : 'Los totales no cuadran (puedes guardar igual)'}
      </p>
      <p className="mt-2 flex justify-between gap-4 text-slate-600">
        Σ subtotales de las líneas <span className="font-semibold text-slate-800">{formatoCLP(suma)}</span>
      </p>
      <ul className="mt-2 space-y-1">
        {resultados.map((r) => (
          <li key={r.tipo} className="flex items-start justify-between gap-4">
            <span className={`flex items-start gap-1.5 ${r.ok || r.informativo ? 'text-slate-600' : 'text-amber-800'}`}>
              {r.informativo ? (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : r.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {NOMBRES_CUADRE[r.tipo]}
                <span className="block text-xs text-slate-500">
                  Esperado {formatoCLP(r.esperado)}
                  {r.informativo && ' (informativo)'}
                </span>
              </span>
            </span>
            <span className={`whitespace-nowrap ${r.ok ? 'text-slate-500' : r.informativo ? 'text-slate-600' : 'font-semibold text-amber-800'}`}>
              {r.ok ? 'OK' : `${r.diferencia > 0 ? '+' : ''}${formatoCLP(r.diferencia)}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Diferencias de hasta ±{TOLERANCIA_CUADRE} peso se consideran cuadradas.</p>
    </div>
  )
}

export default PanelCuadre
