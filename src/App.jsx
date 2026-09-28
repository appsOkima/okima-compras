import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PaginaPendiente from './components/PaginaPendiente'
import Categorias from './pages/insumos/Categorias'
import Insumos from './pages/insumos/Insumos'
import SeccionInsumos from './pages/insumos/SeccionInsumos'
import Subcategorias from './pages/insumos/Subcategorias'
import Catalogo from './pages/proveedores/Catalogo'
import PorVincular from './pages/proveedores/PorVincular'
import Proveedores from './pages/proveedores/Proveedores'
import SeccionProveedores from './pages/proveedores/SeccionProveedores'
import { secciones } from './secciones'

// Secciones que ya tienen pantalla propia (con subrutas); el resto sigue con
// PaginaPendiente hasta que se construya en la Fase 4.
const conPantalla = new Set(['/insumos', '/proveedores'])

// Sin login: todas las secciones quedan disponibles directamente.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to={secciones[0].path} replace />} />
          {secciones
            .filter((seccion) => !conPantalla.has(seccion.path))
            .map((seccion) => (
              <Route key={seccion.path} path={seccion.path} element={<PaginaPendiente seccion={seccion} />} />
            ))}
          <Route path="/insumos" element={<SeccionInsumos />}>
            <Route index element={<Insumos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="subcategorias" element={<Subcategorias />} />
          </Route>
          <Route path="/proveedores" element={<SeccionProveedores />}>
            <Route index element={<Proveedores />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="por-vincular" element={<PorVincular />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
