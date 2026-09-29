import { useMemo } from 'react'
import { Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP } from '../../lib/formato'

const SELECT_PLANTILLAS = 'id, nombre, monto_default, activo'

// Atajos de gasto recurrente: un enlace por plantilla activa que abre el
// formulario del gasto en su página, pre-llenado desde la plantilla (concepto,
// subcategoría y monto; solo queda confirmar la fecha): /gastos/nuevo?plantilla=<id>,
// ver FormularioGasto. Al guardar se vuelve al listado con el aviso de éxito.
function IngresoRapido() {
  const { filas: plantillas, cargando, error } = useTabla('plantillas_gastos_recurrentes', {
    select: SELECT_PLANTILLAS,
  })

  const activas = useMemo(() => plantillas.filter((p) => p.activo), [plantillas])

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Repeat className="h-4 w-4 text-indigo-600" />
        Ingreso rápido de gasto recurrente
      </h3>

      {cargando ? (
        <p className="mt-2 text-sm text-slate-500">Cargando plantillas…</p>
      ) : error ? (
        <p className="mt-2 text-sm text-red-600">No se pudieron cargar las plantillas: {mensajeError(error)}</p>
      ) : activas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No hay plantillas activas.{' '}
          <Link to="/gastos/plantillas" className="font-medium text-indigo-700 hover:underline">
            Crea una en Plantillas recurrentes
          </Link>
          .
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {activas.map((p) => (
            <Link
              key={p.id}
              to={`/gastos/nuevo?plantilla=${p.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
            >
              {p.nombre}
              <span className="text-xs font-normal text-indigo-600">{formatoCLP(p.monto_default)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default IngresoRapido
