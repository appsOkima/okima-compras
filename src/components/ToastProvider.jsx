import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ContextoToast } from '../hooks/useToast'

const DURACION_MS = 8000

const ESTILOS = {
  aviso: { caja: 'border-amber-200 bg-amber-50 text-amber-800', Icono: AlertCircle },
  error: { caja: 'border-red-200 bg-red-50 text-red-700', Icono: AlertCircle },
  ok: { caja: 'border-green-200 bg-green-50 text-green-800', Icono: CheckCircle2 },
  info: { caja: 'border-slate-200 bg-white text-slate-700', Icono: Info },
}

// Avisos breves que no bloquean: se cierran solos o con la X. Vive dentro de Layout,
// así un aviso emitido justo antes de navegar sigue visible en la pantalla siguiente.
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const siguiente = useRef(0)

  const cerrar = useCallback((id) => setToasts((actuales) => actuales.filter((t) => t.id !== id)), [])
  const avisar = useCallback(
    (texto, { tipo = 'aviso' } = {}) => {
      const id = ++siguiente.current
      setToasts((actuales) => [...actuales, { id, texto, tipo }])
      setTimeout(() => cerrar(id), DURACION_MS)
    },
    [cerrar],
  )
  const valor = useMemo(() => ({ avisar }), [avisar])

  return (
    <ContextoToast.Provider value={valor}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
        {toasts.map(({ id, texto, tipo }) => {
          const { caja, Icono } = ESTILOS[tipo] ?? ESTILOS.aviso
          return (
            <div key={id} role="status" className={`flex items-start gap-2 rounded-md border p-3 text-sm shadow-md ${caja}`}>
              <Icono className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{texto}</p>
              <button type="button" onClick={() => cerrar(id)} aria-label="Cerrar aviso" className="shrink-0 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ContextoToast.Provider>
  )
}

export default ToastProvider
