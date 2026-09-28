import { NavLink } from 'react-router-dom'

// Sub-navegación de una sección (ej. Insumos / Categorías / Subcategorías).
function Pestanas({ pestanas }) {
  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
      {pestanas.map(({ ruta, titulo, end }) => (
        <NavLink
          key={ruta}
          to={ruta}
          end={end}
          className={({ isActive }) =>
            `-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              isActive
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`
          }
        >
          {titulo}
        </NavLink>
      ))}
    </nav>
  )
}

export default Pestanas
