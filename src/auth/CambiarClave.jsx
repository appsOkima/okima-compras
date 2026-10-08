import { useState } from 'react'
import { claseBotonPrimario, claseInput } from '../components/estilos'
import { errorNuevaClave } from '../lib/credenciales'
import { useAuth } from './contexto'

// Cambio de clave obligatorio del primer ingreso (la clave inicial es común y temporal).
function CambiarClave() {
  const { cambiarClave, cerrarSesion } = useAuth()
  const [clave, setClave] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    const invalida = errorNuevaClave(clave, confirmacion)
    if (invalida) return setError(invalida)
    setGuardando(true)
    setError(await cambiarClave(clave))
    setGuardando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Elige tu clave</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ingresaste con una clave temporal. Define una nueva para continuar (mínimo 8 caracteres).
          </p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Clave nueva
          <input type="password" autoComplete="new-password" className={`${claseInput} mt-1`} value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Repite la clave
          <input type="password" autoComplete="new-password" className={`${claseInput} mt-1`} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex items-center justify-between">
          <button type="button" onClick={cerrarSesion} className="text-sm text-slate-500 hover:text-slate-800">
            Cerrar sesión
          </button>
          <button type="submit" disabled={guardando} className={claseBotonPrimario}>
            {guardando ? 'Guardando…' : 'Guardar clave'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CambiarClave
