import { createContext, useContext } from 'react'

// Contexto de los avisos toast que provee ToastProvider (dentro de Layout).
export const ContextoToast = createContext(null)

// → { avisar(texto, { tipo = 'aviso' | 'error' | 'ok' }) }. Sin proveedor no hace nada.
export function useToast() {
  return useContext(ContextoToast) ?? { avisar: () => {} }
}
