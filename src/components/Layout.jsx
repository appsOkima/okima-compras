import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Menu, PackageSearch, X } from 'lucide-react'
import { secciones } from '../secciones'

// Menú lateral fijo en escritorio; en móvil se abre desde la barra superior.
// Todo el menú lleva print:hidden para que la impresión muestre solo el contenido.
function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 md:flex">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden print:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-20 bg-slate-900/30 md:hidden print:hidden" onClick={cerrarMenu} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 print:hidden ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="hidden px-5 py-5 md:block">
          <Marca />
        </div>
        <nav className="flex flex-col gap-1 px-3 py-4 md:py-0">
          {secciones.map(({ path, titulo, icono: Icono }) => (
            <NavLink
              key={path}
              to={path}
              onClick={cerrarMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icono className="h-5 w-5 shrink-0" />
              {titulo}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}

function Marca() {
  return (
    <div className="flex items-center gap-2">
      <PackageSearch className="h-6 w-6 text-indigo-600" />
      <span className="text-lg font-semibold">Okima Compras</span>
    </div>
  )
}

export default Layout
