import { PackageSearch } from 'lucide-react'

// Placeholder de la Fase 1: el layout y las rutas llegan en la Fase 3.
function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-800">
      <div className="flex items-center gap-3">
        <PackageSearch className="h-8 w-8 text-indigo-600" />
        <h1 className="text-2xl font-semibold">Okima Compras</h1>
      </div>
    </main>
  )
}

export default App
