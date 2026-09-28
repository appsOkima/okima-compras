import { etiquetaMes } from '../lib/gastos'
import { claseInput } from './estilos'

// Selector "Mes" para filtrar tablas por fecha. `meses` = ['YYYY-MM', …] del más
// reciente al más antiguo (ver mesesPresentes); `valor` '' = todos los meses.
// Si el mes elegido ya no tiene registros (ej. se borró el último), se mantiene
// como opción para que el filtro no quede en un valor invisible.
function FiltroMes({ meses, valor, onChange }) {
  const opciones = valor && !meses.includes(valor) ? [valor, ...meses] : meses
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
      Mes
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${claseInput} w-auto`}>
        <option value="">Todos</option>
        {opciones.map((m) => (
          <option key={m} value={m}>
            {etiquetaMes(m)}
          </option>
        ))}
      </select>
    </label>
  )
}

export default FiltroMes
