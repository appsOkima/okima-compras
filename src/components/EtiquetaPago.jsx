import { textoEstadoPago } from '../lib/pagos'

const CLASES = {
  pagado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pendiente: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  parcial: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  anulado: 'bg-red-50 text-red-700 ring-red-600/20',
}

// Pastilla con el estado de pago de una fila de vista_estado_pago ({ estado_pago, saldo });
// sin fila (aún cargando) no muestra nada.
function EtiquetaPago({ fila }) {
  const texto = textoEstadoPago(fila)
  if (!texto) return null
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CLASES[fila.estado_pago]}`}>
      {texto}
    </span>
  )
}

export default EtiquetaPago
