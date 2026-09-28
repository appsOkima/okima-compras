import { Outlet } from 'react-router-dom'
import { secciones } from '../secciones'
import Pestanas from './Pestanas'

// Encabezado de una sección (título, ícono y descripción de secciones.js) con sus
// pestañas; cada subsección se renderiza en el Outlet. Sin `pestanas` (sección de
// una sola pantalla, ej. Insumos Okima) se muestra solo el encabezado.
// Al imprimir se oculta el encabezado: cada pantalla imprimible pone el suyo.
function SeccionConPestanas({ path, pestanas = [] }) {
  const { titulo, descripcion, icono: Icono } = secciones.find((s) => s.path === path)

  return (
    <div>
      <div className="print:hidden">
        <div className="flex items-center gap-3">
          <Icono className="h-7 w-7 text-indigo-600" />
          <h1 className="text-2xl font-semibold">{titulo}</h1>
        </div>
        <p className="mt-2 text-slate-600">{descripcion}</p>
      </div>
      {pestanas.length > 0 && <Pestanas pestanas={pestanas} />}
      <Outlet />
    </div>
  )
}

export default SeccionConPestanas
