// Contenido provisorio de cada sección hasta que se construya en la Fase 4.
function PaginaPendiente({ seccion }) {
  const { titulo, descripcion, icono: Icono } = seccion

  return (
    <section>
      <div className="flex items-center gap-3">
        <Icono className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-semibold">{titulo}</h1>
      </div>
      <p className="mt-2 text-slate-600">{descripcion}</p>
      <p className="mt-6 rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Esta pantalla se construye en la Fase 4.
      </p>
    </section>
  )
}

export default PaginaPendiente
