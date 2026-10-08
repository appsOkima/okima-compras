import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ContextoBusquedas } from '../hooks/useBusquedaPersistente'
import { crearAlmacenBusquedas } from '../lib/filtrosPersistentes'

// Vive dentro de Layout (solo existe con sesión): cerrar sesión o recargar la página lo
// destruye. Se vacía al cambiar de sección, antes de que las pantallas hijas lean su
// texto; es idempotente, así que repetirlo en un render no le hace daño.
function BusquedasProvider({ children }) {
  const [almacen] = useState(crearAlmacenBusquedas)
  const { pathname } = useLocation()
  almacen.alNavegar(pathname)
  return <ContextoBusquedas.Provider value={almacen}>{children}</ContextoBusquedas.Provider>
}

export default BusquedasProvider
