import { lazy } from 'react'
import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import PaginaPendiente from './components/PaginaPendiente'
import SeccionConPestanas from './components/SeccionConPestanas'
import SeccionCentrosCosto from './pages/centros-costo/SeccionCentrosCosto'
import SeccionFacturas from './pages/facturas/SeccionFacturas'
import SeccionGastos from './pages/gastos/SeccionGastos'
import SeccionProveedores from './pages/proveedores/SeccionProveedores'
import SeccionSolicitudes from './pages/solicitudes/SeccionSolicitudes'
import { secciones } from './secciones'

// Cada pantalla se descarga al visitarla: el bundle inicial queda liviano.
const Categorias = lazy(() => import('./pages/centros-costo/Categorias'))
const Subcategorias = lazy(() => import('./pages/centros-costo/Subcategorias'))
const Facturas = lazy(() => import('./pages/facturas/Facturas'))
const FormularioFactura = lazy(() => import('./pages/facturas/FormularioFactura'))
const Lineas = lazy(() => import('./pages/facturas/Lineas'))
const Gastos = lazy(() => import('./pages/gastos/Gastos'))
const Plantillas = lazy(() => import('./pages/gastos/Plantillas'))
const Insumos = lazy(() => import('./pages/insumos/Insumos'))
const Catalogo = lazy(() => import('./pages/proveedores/Catalogo'))
const FormularioProveedor = lazy(() => import('./pages/proveedores/FormularioProveedor'))
const PorVincular = lazy(() => import('./pages/proveedores/PorVincular'))
const Proveedores = lazy(() => import('./pages/proveedores/Proveedores'))
const Pendientes = lazy(() => import('./pages/solicitudes/Pendientes'))
const Todas = lazy(() => import('./pages/solicitudes/Todas'))

// Secciones que ya tienen pantalla propia (con subrutas); el resto sigue con
// PaginaPendiente hasta que se construya en la Fase 4.
const conPantalla = new Set(['/solicitudes', '/facturas', '/gastos', '/insumos', '/proveedores', '/centros-costo'])

// Sin login: todas las secciones quedan disponibles directamente.
// Enrutador de datos (createBrowserRouter) y no <BrowserRouter>: lo exige
// useBlocker, que confirma antes de salir de un formulario con cambios sin
// guardar (ver hooks/useConfirmarSalida). Se crea una sola vez, fuera del componente.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Layout />}>
      <Route index element={<Navigate to={secciones[0].path} replace />} />
      {secciones
        .filter((seccion) => !conPantalla.has(seccion.path))
        .map((seccion) => (
          <Route key={seccion.path} path={seccion.path} element={<PaginaPendiente seccion={seccion} />} />
        ))}
      <Route path="/solicitudes" element={<SeccionSolicitudes />}>
        <Route index element={<Pendientes />} />
        {/* key: cada pestaña parte con su propio estado de búsqueda y filtro. */}
        <Route path="compradas" element={<Todas key="compradas" estadoFijo="Comprada" />} />
        <Route path="canceladas" element={<Todas key="canceladas" estadoFijo="Cancelada" />} />
        <Route path="todas" element={<Todas key="todas" />} />
      </Route>
      {/* El formulario maestro-detalle es una página de la sección (no un modal). */}
      <Route path="/facturas" element={<SeccionFacturas />}>
        <Route index element={<Facturas />} />
        <Route path="lineas" element={<Lineas />} />
        <Route path="nueva" element={<FormularioFactura />} />
        <Route path=":id" element={<FormularioFactura />} />
      </Route>
      <Route path="/gastos" element={<SeccionGastos />}>
        <Route index element={<Gastos />} />
        <Route path="plantillas" element={<Plantillas />} />
      </Route>
      {/* Una sola pantalla: encabezado de sección sin barra de pestañas. */}
      <Route path="/insumos" element={<SeccionConPestanas path="/insumos" />}>
        <Route index element={<Insumos />} />
      </Route>
      {/* El formulario de proveedor también es una página de la sección (no un
          modal); catalogo y por-vincular ganan a :id por ser rutas estáticas. */}
      <Route path="/proveedores" element={<SeccionProveedores />}>
        <Route index element={<Proveedores />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="por-vincular" element={<PorVincular />} />
        <Route path="nuevo" element={<FormularioProveedor />} />
        <Route path=":id" element={<FormularioProveedor />} />
      </Route>
      <Route path="/centros-costo" element={<SeccionCentrosCosto />}>
        <Route index element={<Categorias />} />
        <Route path="subcategorias" element={<Subcategorias />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  ),
)

function App() {
  return <RouterProvider router={router} />
}

export default App
