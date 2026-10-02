import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { puedeVerSeccion, rutaInicial } from '../lib/permisos'
import { useAuth } from './contexto'
import CambiarClave from './CambiarClave'
import PantallaAviso from './PantallaAviso'

// Exige sesión + perfil, el cambio de clave pendiente y que el rol vea la sección.
// Es ergonomía: la seguridad real es el RLS de la base.
function ProtectedRoute() {
  const { sesion, perfil, cargando, debeCambiarClave, cerrarSesion } = useAuth()
  const { pathname } = useLocation()

  if (cargando) return <p className="p-8 text-sm text-slate-500" role="status">Cargando…</p>
  if (!sesion) return <Navigate to="/login" replace state={{ desde: pathname }} />
  if (!perfil) {
    return (
      <PantallaAviso titulo="Tu usuario aún no tiene acceso" onSalir={cerrarSesion}>
        Tu cuenta no tiene un perfil asignado. Pide a un administrador que lo configure.
      </PantallaAviso>
    )
  }
  if (debeCambiarClave) return <CambiarClave />
  if (pathname === '/') return <Navigate to={rutaInicial(perfil.rol)} replace />
  if (!puedeVerSeccion(perfil.rol, pathname)) {
    return (
      <PantallaAviso titulo="Sin acceso" onSalir={cerrarSesion} volverA={rutaInicial(perfil.rol)}>
        Tu rol no tiene permiso para ver esta sección.
      </PantallaAviso>
    )
  }
  return <Outlet />
}

export default ProtectedRoute
