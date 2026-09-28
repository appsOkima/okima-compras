import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PaginaPendiente from './components/PaginaPendiente'
import SeccionConPestanas from './components/SeccionConPestanas'
import Categorias from './pages/centros-costo/Categorias'
import SeccionCentrosCosto from './pages/centros-costo/SeccionCentrosCosto'
import Subcategorias from './pages/centros-costo/Subcategorias'
import Gastos from './pages/gastos/Gastos'
import Plantillas from './pages/gastos/Plantillas'
import SeccionGastos from './pages/gastos/SeccionGastos'
import Insumos from './pages/insumos/Insumos'
import Catalogo from './pages/proveedores/Catalogo'
import PorVincular from './pages/proveedores/PorVincular'
import Proveedores from './pages/proveedores/Proveedores'
import SeccionProveedores from './pages/proveedores/SeccionProveedores'
import Pendientes from './pages/solicitudes/Pendientes'
import SeccionSolicitudes from './pages/solicitudes/SeccionSolicitudes'
import Todas from './pages/solicitudes/Todas'
import { secciones } from './secciones'

// Secciones que ya tienen pantalla propia (con subrutas); el resto sigue con
// PaginaPendiente hasta que se construya en la Fase 4.
const conPantalla = new Set(['/solicitudes', '/gastos', '/insumos', '/proveedores', '/centros-costo'])

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
          <Route path="/solicitudes" element={<SeccionSolicitudes />}>
            <Route index element={<Pendientes />} />
            <Route path="todas" element={<Todas />} />
          </Route>
          <Route path="/gastos" element={<SeccionGastos />}>
            <Route index element={<Gastos />} />
            <Route path="plantillas" element={<Plantillas />} />
          </Route>
          {/* Una sola pantalla: encabezado de sección sin barra de pestañas. */}
          <Route path="/insumos" element={<SeccionConPestanas path="/insumos" />}>
            <Route index element={<Insumos />} />
          </Route>
          <Route path="/proveedores" element={<SeccionProveedores />}>
            <Route index element={<Proveedores />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="por-vincular" element={<PorVincular />} />
          </Route>
          <Route path="/centros-costo" element={<SeccionCentrosCosto />}>
            <Route index element={<Categorias />} />
            <Route path="subcategorias" element={<Subcategorias />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
