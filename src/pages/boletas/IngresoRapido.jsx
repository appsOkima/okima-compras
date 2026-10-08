import { useMemo } from 'react'
import { Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP } from '../../lib/formato'

const SELECT_PLANTILLAS = 'id, nombre, monto_default, activo'

// Atajos de gasto recurrente: un enlace por plantilla activa que abre el
// formulario de la boleta en su página, pre-llenado desde la plantilla (subcategoría y
// una línea con el nombre y el monto; solo queda confirmar la fecha): /boletas/nuevo?plantilla=<id>,
// ver FormularioBoleta. Al guardar se vuelve al listado con el aviso de éxito.
function IngresoRapido() {
  const { filas: plantillas, cargando, error } = useTabla('plantillas_gastos_recurrentes', {
    select: SELECT_PLANTILLAS,
  })

  const activas = useMemo(() => plantillas.filter((p) => p.activo), [plantillas])

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Repeat className="h-4 w-4 text-primary" />
        Ingreso rápido de gasto recurrente
      </h3>

      {cargando ? (
        <p className="mt-2 text-sm text-slate-500">Cargando plantillas…</p>
      ) : error ? (
        <p className="mt-2 text-sm text-red-600">No se pudieron cargar las plantillas: {mensajeError(error)}</p>
      ) : activas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No hay plantillas activas.{' '}
          <Link to="/boletas/plantillas" className="font-medium text-primary-darker hover:underline">
            Crea una en Plantillas recurrentes
          </Link>
          .
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {activas.map((p) => (
            <Link
              key={p.id}
              to={`/boletas/nuevo?plantilla=${p.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-darker hover:bg-primary-100"
            >
              {p.nombre}
              <span className="text-xs font-normal text-primary-dark">{formatoCLP(p.monto_default)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default IngresoRapido
