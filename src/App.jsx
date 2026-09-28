import { useEffect, useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { supabase } from './lib/supabase'

// Placeholder: el layout y las rutas llegan en la Fase 3. Por ahora solo
// comprueba la conexión a Supabase contando las categorías sembradas.
function App() {
  const [estado, setEstado] = useState({ tipo: 'cargando' })

  useEffect(() => {
    supabase
      .from('categorias')
      .select('*', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) setEstado({ tipo: 'error', mensaje: error.message })
        else if (count == null) setEstado({ tipo: 'error', mensaje: 'la respuesta no trae el conteo (¿URL de Supabase correcta?)' })
        else setEstado({ tipo: 'ok', count })
      })
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-800">
      <div className="flex items-center gap-3">
        <PackageSearch className="h-8 w-8 text-indigo-600" />
        <h1 className="text-2xl font-semibold">Okima Compras</h1>
      </div>
      {estado.tipo === 'cargando' && <p className="text-slate-500">Conectando con Supabase…</p>}
      {estado.tipo === 'ok' && (
        <p className="text-emerald-700">Conectado a Supabase: {estado.count} categorías.</p>
      )}
      {estado.tipo === 'error' && (
        <p className="text-red-700">Error al conectar con Supabase: {estado.mensaje}</p>
      )}
    </main>
  )
}

export default App
