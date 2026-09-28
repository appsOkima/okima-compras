import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PaginaPendiente from './components/PaginaPendiente'
import { secciones } from './secciones'

// Sin login: todas las secciones quedan disponibles directamente.
// En la Fase 4 cada PaginaPendiente se reemplaza por la pantalla real.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to={secciones[0].path} replace />} />
          {secciones.map((seccion) => (
            <Route key={seccion.path} path={seccion.path} element={<PaginaPendiente seccion={seccion} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
