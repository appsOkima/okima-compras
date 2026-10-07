import { claseInput } from './estilos'

// Selector "Pago" para filtrar el listado por estado de pago; '' = todos.
function FiltroEstadoPago({ valor, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
      Pago
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${claseInput} w-auto`}>
        <option value="">Todos</option>
        <option value="pendiente">Pendiente</option>
        <option value="parcial">Parcial</option>
        <option value="pagado">Pagado</option>
      </select>
    </label>
  )
}

export default FiltroEstadoPago
