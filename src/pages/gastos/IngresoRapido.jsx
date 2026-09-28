import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import FormularioRegistro from '../../components/FormularioRegistro'
import Modal from '../../components/Modal'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha } from '../../lib/formato'
import { etiquetaMes, gastosDePlantillaEnMes, mesDe } from '../../lib/gastos'
import { hoyISO } from '../../lib/solicitudes'

const SELECT_PLANTILLAS = 'id, nombre, id_subcategoria, monto_default, activo'

// Tiempo que queda visible la confirmación de un gasto registrado.
const DURACION_CONFIRMACION = 5000

const etiquetaGasto = (g) => `${g.concepto} — ${formatoFecha(g.fecha)} — ${formatoCLP(g.monto)}`

// Atajos de gasto recurrente: un botón por plantilla activa que abre el formulario
// del gasto pre-llenado (concepto, subcategoría y monto); solo queda confirmar la
// fecha. `gastos` y `crear` vienen del Mantenedor de Gastos, así el gasto nuevo
// aparece en su tabla y el aviso de "ya registrado" usa las mismas filas.
function IngresoRapido({ gastos, crear, campos }) {
  const { filas: plantillas, cargando, error } = useTabla('plantillas_gastos_recurrentes', {
    select: SELECT_PLANTILLAS,
  })
  const [plantilla, setPlantilla] = useState(null)
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    if (!confirmacion) return
    const temporizador = setTimeout(() => setConfirmacion(''), DURACION_CONFIRMACION)
    return () => clearTimeout(temporizador)
  }, [confirmacion])

  const activas = useMemo(() => plantillas.filter((p) => p.activo), [plantillas])

  const abrir = (elegida) => {
    setConfirmacion('')
    setPlantilla(elegida)
  }

  // id_plantilla_recurrente no es un campo del formulario: se agrega aquí y el
  // formulario de edición nunca lo envía, así que se conserva.
  const guardar = async (valores) => {
    await crear({ ...valores, id_plantilla_recurrente: plantilla.id })
    setConfirmacion(`Gasto "${valores.concepto}" registrado por ${formatoCLP(valores.monto)}.`)
    setPlantilla(null)
  }

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
            <button
              key={p.id}
              type="button"
              onClick={() => abrir(p)}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
            >
              {p.nombre}
              <span className="text-xs font-normal text-indigo-600">{formatoCLP(p.monto_default)}</span>
            </button>
          ))}
        </div>
      )}

      {confirmacion && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {confirmacion}
        </p>
      )}

      {plantilla && (
        <Modal titulo={`Registrar gasto: ${plantilla.nombre}`} onCerrar={() => setPlantilla(null)}>
          <FormularioRegistro
            key={plantilla.id}
            campos={campos}
            valoresIniciales={{
              concepto: plantilla.nombre,
              id_subcategoria: plantilla.id_subcategoria ?? '',
              // Monto 0 (valor semilla) se deja vacío para que se escriba el real.
              monto: Number(plantilla.monto_default) > 0 ? plantilla.monto_default : '',
              fecha: hoyISO(),
              id_proveedor: '',
              numero_documento: '',
              notas: '',
            }}
            onGuardar={guardar}
            onCancelar={() => setPlantilla(null)}
            // Primer clic: avisa si esta plantilla ya tiene gasto en el mes de la fecha elegida.
            buscarDuplicados={(valores) => gastosDePlantillaEnMes(gastos, plantilla.id, valores.fecha)}
            etiquetaDuplicado={etiquetaGasto}
            textoDuplicados={(lista) => `Ya registraste ${plantilla.nombre} en ${etiquetaMes(mesDe(lista[0]?.fecha))}:`}
          />
        </Modal>
      )}
    </div>
  )
}

export default IngresoRapido
