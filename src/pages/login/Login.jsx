import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PackageSearch } from 'lucide-react'
import { useAuth } from '../../auth/contexto'
import { claseBotonPrimario, claseInput } from '../../components/estilos'

function Login() {
  const { sesion, cargando, iniciarSesion } = useAuth()
  const { state } = useLocation()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (!cargando && sesion) return <Navigate to={state?.desde ?? '/'} replace />

  async function enviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setError(await iniciarSesion(usuario, clave))
    setEnviando(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <PackageSearch className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold text-slate-800">Okima Compras</h1>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Usuario
          <input
            autoFocus
            autoComplete="username"
            placeholder="tu nombre o tu email"
            className={`${claseInput} mt-1`}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Clave
          <input type="password" autoComplete="current-password" className={`${claseInput} mt-1`} value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={enviando} className={`${claseBotonPrimario} w-full`}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

export default Login
