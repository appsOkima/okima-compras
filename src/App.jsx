import { lazy, Suspense } from 'react'
import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import PaginaPendiente from './components/PaginaPendiente'
import SeccionConPestanas from './components/SeccionConPestanas'
import SeccionCentrosCosto from './pages/centros-costo/SeccionCentrosCosto'
import SeccionFacturas from './pages/facturas/SeccionFacturas'
import SeccionBoletas from './pages/boletas/SeccionBoletas'
import SeccionProveedores from './pages/proveedores/SeccionProveedores'
import SeccionSolicitudes from './pages/solicitudes/SeccionSolicitudes'
import { secciones } from './secciones'

// Cada pantalla se descarga al visitarla: el bundle inicial queda liviano.
const Categorias = lazy(() => import('./pages/centros-costo/Categorias'))
const Subcategorias = lazy(() => import('./pages/centros-costo/Subcategorias'))
const Facturas = lazy(() => import('./pages/facturas/Facturas'))
const FormularioFactura = lazy(() => import('./pages/facturas/FormularioFactura'))
const PaginaDetalleFactura = lazy(() => import('./pages/facturas/PaginaDetalleFactura'))
const FormularioBoleta = lazy(() => import('./pages/boletas/FormularioBoleta'))
const PaginaDetalleBoleta = lazy(() => import('./pages/boletas/PaginaDetalleBoleta'))
const Lineas = lazy(() => import('./pages/facturas/Lineas'))
const Boletas = lazy(() => import('./pages/boletas/Boletas'))
const LineasBoletas = lazy(() => import('./pages/boletas/Lineas'))
const Plantillas = lazy(() => import('./pages/boletas/Plantillas'))
const FormularioInsumo = lazy(() => import('./pages/insumos/FormularioInsumo'))
const Insumos = lazy(() => import('./pages/insumos/Insumos'))
const Catalogo = lazy(() => import('./pages/proveedores/Catalogo'))
const FormularioInsumoProveedor = lazy(() => import('./pages/proveedores/FormularioInsumoProveedor'))
const FormularioProveedor = lazy(() => import('./pages/proveedores/FormularioProveedor'))
const PorVincular = lazy(() => import('./pages/proveedores/PorVincular'))
const Proveedores = lazy(() => import('./pages/proveedores/Proveedores'))
const Pendientes = lazy(() => import('./pages/solicitudes/Pendientes'))
const Pagos = lazy(() => import('./pages/pagos/Pagos'))
const Resumen = lazy(() => import('./pages/resumen/Resumen'))
const Todas = lazy(() => import('./pages/solicitudes/Todas'))
const Login = lazy(() => import('./pages/login/Login'))

// Secciones que ya tienen pantalla propia (con subrutas); el resto sigue con
// PaginaPendiente hasta que se construya en la Fase 4.
const conPantalla = new Set(['/solicitudes', '/facturas', '/boletas', '/pagos', '/resumen', '/insumos', '/proveedores', '/centros-costo'])

// Login con Supabase Auth: ProtectedRoute exige sesión y perfil, y deja pasar solo
// las secciones permitidas al rol (lib/permisos). /login queda fuera del Layout.
// Enrutador de datos (createBrowserRouter) y no <BrowserRouter>: lo exige
// useBlocker, que confirma antes de salir de un formulario con cambios sin
// guardar (ver hooks/useConfirmarSalida). Se crea una sola vez, fuera del componente.
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
    <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
    <Route element={<ProtectedRoute />}>
    <Route element={<Layout />}>
      {/* El inicio ('/') lo redirige ProtectedRoute a la primera sección del rol. */}
      <Route index element={null} />
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
        {/* "Ver detalles" a pantalla completa; dos segmentos, no choca con :id. */}
        <Route path=":id/detalle" element={<PaginaDetalleFactura />} />
      </Route>
      {/* Los formularios de boleta, insumo, proveedor y catálogo también son
          páginas de su sección (no modales); las rutas estáticas (plantillas,
          catalogo, por-vincular, nuevo) ganan a :id. */}
      <Route path="/boletas" element={<SeccionBoletas />}>
        <Route index element={<Boletas />} />
        <Route path="lineas" element={<LineasBoletas />} />
        <Route path="plantillas" element={<Plantillas />} />
        {/* ?plantilla=<id>: ingreso rápido de boleta recurrente, pre-llenado. */}
        <Route path="nuevo" element={<FormularioBoleta />} />
        <Route path=":id" element={<FormularioBoleta />} />
        <Route path=":id/detalle" element={<PaginaDetalleBoleta />} />
      </Route>
      {/* Una sola pantalla: encabezado de sección sin barra de pestañas. */}
      <Route path="/pagos" element={<SeccionConPestanas path="/pagos" />}>
        <Route index element={<Pagos />} />
      </Route>
      <Route path="/resumen" element={<SeccionConPestanas path="/resumen" />}>
        <Route index element={<Resumen />} />
      </Route>
      <Route path="/insumos" element={<SeccionConPestanas path="/insumos" />}>
        <Route index element={<Insumos />} />
        <Route path="nuevo" element={<FormularioInsumo />} />
        <Route path=":id" element={<FormularioInsumo />} />
      </Route>
      {/* catalogo/... queda bajo la pestaña Catálogo (sin `end`), que sigue resaltada. */}
      <Route path="/proveedores" element={<SeccionProveedores />}>
        <Route index element={<Proveedores />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="catalogo/nuevo" element={<FormularioInsumoProveedor />} />
        <Route path="catalogo/:id" element={<FormularioInsumoProveedor />} />
        <Route path="por-vincular" element={<PorVincular />} />
        <Route path="nuevo" element={<FormularioProveedor />} />
        <Route path=":id" element={<FormularioProveedor />} />
      </Route>
      <Route path="/centros-costo" element={<SeccionCentrosCosto />}>
        <Route index element={<Categorias />} />
        <Route path="subcategorias" element={<Subcategorias />} />
      </Route>
    </Route>
    </Route>
    {/* La sección se llamaba Otros Gastos (/gastos): enlaces y marcadores viejos. */}
    <Route path="/gastos/*" element={<Navigate to="/boletas" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
    </>
  ),
)

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
