import { Outlet } from 'react-router-dom'
import Pestanas from '../../components/Pestanas'
import { secciones } from '../../secciones'

const seccion = secciones.find((s) => s.path === '/insumos')

const pestanas = [
  { ruta: '/insumos', titulo: 'Insumos', end: true },
  { ruta: '/insumos/categorias', titulo: 'Categorías' },
  { ruta: '/insumos/subcategorias', titulo: 'Subcategorías' },
]

// Encabezado de la sección y pestañas; cada subsección se renderiza en el Outlet.
function SeccionInsumos() {
  const { titulo, descripcion, icono: Icono } = seccion

  return (
    <div>
      <div className="flex items-center gap-3">
        <Icono className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-semibold">{titulo}</h1>
      </div>
      <p className="mt-2 text-slate-600">{descripcion}</p>
      <Pestanas pestanas={pestanas} />
      <Outlet />
    </div>
  )
}

export default SeccionInsumos
