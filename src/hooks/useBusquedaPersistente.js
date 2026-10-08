import { createContext, useCallback, useContext, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Almacén de búsquedas que provee BusquedasProvider (dentro de Layout). Sin proveedor
// (tests) el hook se comporta como un useState normal.
export const ContextoBusquedas = createContext(null)

// Como useState(''), pero el texto sobrevive a salir del listado y volver (a un detalle,
// a editar, a otra pestaña de la sección) hasta que el usuario cambia de sección. La clave
// es el pathname, así cada vista recuerda su propio texto.
export function useBusquedaPersistente() {
  const almacen = useContext(ContextoBusquedas)
  const { pathname } = useLocation()
  const [texto, setTextoLocal] = useState(() => almacen?.leer(pathname) ?? '')
  const setTexto = useCallback(
    (valor) => {
      setTextoLocal((anterior) => {
        const nuevo = typeof valor === 'function' ? valor(anterior) : valor
        almacen?.escribir(pathname, nuevo)
        return nuevo
      })
    },
    [almacen, pathname],
  )
  return [texto, setTexto]
}
