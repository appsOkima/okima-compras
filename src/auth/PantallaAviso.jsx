import { Link } from 'react-router-dom'
import { claseBotonPrimario, claseBotonSecundario } from '../components/estilos'

// Pantalla completa para avisos de acceso: sin perfil o sección no permitida.
function PantallaAviso({ titulo, children, onSalir, volverA }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">{children}</p>
        <div className="mt-5 flex justify-center gap-2">
          {volverA && (
            <Link to={volverA} className={claseBotonPrimario}>
              Ir al inicio
            </Link>
          )}
          <button type="button" onClick={onSalir} className={claseBotonSecundario}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export default PantallaAviso
