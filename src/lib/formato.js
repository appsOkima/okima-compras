// Formatos de presentación (es-CL). Todo monto es CLP, sin decimales.

const VACIO = '—'

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 })

function esVacio(n) {
  return n === null || n === undefined || n === '' || Number.isNaN(Number(n))
}

export function formatoCLP(n) {
  return esVacio(n) ? VACIO : clp.format(Number(n))
}

export function formatoNumero(n) {
  return esVacio(n) ? VACIO : numero.format(Number(n))
}

// 'YYYY-MM-DD' → 'dd-mm-aaaa'. Se parsea a mano: new Date('2026-09-28') es UTC
// y en Chile mostraría el día anterior.
export function formatoFecha(isoDate) {
  if (!isoDate) return VACIO
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate))
  if (!m) return String(isoDate)
  return `${m[3]}-${m[2]}-${m[1]}`
}

// Marca de tiempo (ej. created_at, en UTC) → 'dd-mm-aaaa' en la hora local, para
// que un registro creado de noche en Chile no aparezca con la fecha del día siguiente.
export function formatoFechaLocal(marcaTiempo) {
  if (!marcaTiempo) return VACIO
  const fecha = new Date(marcaTiempo)
  if (Number.isNaN(fecha.getTime())) return String(marcaTiempo)
  const dos = (n) => String(n).padStart(2, '0')
  return `${dos(fecha.getDate())}-${dos(fecha.getMonth() + 1)}-${fecha.getFullYear()}`
}

// Formato de compra de un insumo de proveedor: "caja de 12", "caja", "12 unid.".
export function formatoCompra(cantidadFormato, formatoUnidad) {
  const unidad = String(formatoUnidad ?? '').trim()
  const cantidad = esVacio(cantidadFormato) ? '' : formatoNumero(cantidadFormato)
  if (unidad && cantidad) return `${unidad} de ${cantidad}`
  if (unidad) return unidad
  if (cantidad) return `${cantidad} unid.`
  return VACIO
}

// Ancho × alto × profundidad en milímetros; '—' si no hay ninguna medida.
export function formatoDimensiones(ancho, alto, profundidad) {
  const medidas = [ancho, alto, profundidad]
  if (medidas.every(esVacio)) return VACIO
  return `${medidas.map(formatoNumero).join(' × ')} mm`
}
