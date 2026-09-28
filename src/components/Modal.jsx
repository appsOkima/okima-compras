import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

const FOCALIZABLES =
  'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Diálogo simple: cierra con Escape o clic en el fondo, enfoca el primer campo,
// mantiene el Tab dentro del panel y devuelve el foco a quien lo abrió al cerrar.
// `ancho` (clase max-w-*) agranda el diálogo cuando lleva una tabla (ej. factura).
function Modal({ titulo, onCerrar, ancho = 'max-w-lg', children }) {
  const idTitulo = useId()
  const panel = useRef(null)
  // Referencia estable al callback para no re-suscribir el teclado en cada render.
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    const alPresionar = (e) => {
      if (e.key === 'Escape') return cerrar.current?.()
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll(FOCALIZABLES)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return e.preventDefault()
      const primero = items[0]
      const ultimo = items[items.length - 1]
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || activo === panel.current)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [])

  useEffect(() => {
    const previo = document.activeElement
    const primero = panel.current?.querySelector('input:not([type=hidden]), select, textarea')
    ;(primero ?? panel.current)?.focus()
    return () => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center print:hidden"
      // mousedown y no click: arrastrar una selección de texto hasta el fondo no debe cerrar.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`my-8 w-full ${ancho} rounded-lg bg-white shadow-xl focus:outline-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id={idTitulo} className="text-lg font-semibold text-slate-800">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export default Modal
