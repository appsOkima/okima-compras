// Reglas de presentación de Otros Gastos (sin React ni Supabase, para poder
// verificarlas con node).

// Nombres fijos y no Intl: el resultado no depende del navegador ni de node.
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// 'YYYY-MM-DD' → 'YYYY-MM'; null si no es una fecha. Se lee el texto tal cual:
// new Date('2026-09-01') es UTC y en Chile caería en el mes anterior.
export function mesDe(fecha) {
  const m = /^(\d{4})-(\d{2})/.exec(String(fecha ?? ''))
  return m ? `${m[1]}-${m[2]}` : null
}

// '2026-09' → 'septiembre 2026'; un valor no reconocido se devuelve tal cual.
export function etiquetaMes(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes ?? ''))
  const nombre = m ? MESES[Number(m[2]) - 1] : undefined
  return nombre ? `${nombre} ${m[1]}` : String(mes ?? '')
}

// Meses distintos con gastos, del más reciente al más antiguo (para el filtro "Mes").
export function mesesPresentes(filas) {
  const meses = new Set()
  for (const fila of filas ?? []) {
    const mes = mesDe(fila?.fecha)
    if (mes) meses.add(mes)
  }
  // 'YYYY-MM' ordena igual como texto que como fecha.
  return [...meses].sort().reverse()
}

// Gastos originados en esa plantilla dentro del mismo mes que `fecha`.
export function gastosDePlantillaEnMes(filas, idPlantilla, fecha) {
  const mes = mesDe(fecha)
  if (!idPlantilla || !mes) return []
  return (filas ?? []).filter((f) => f?.id_plantilla_recurrente === idPlantilla && mesDe(f.fecha) === mes)
}

// Aviso del ingreso rápido: ¿ya se registró esa plantilla ese mes?
export function yaRegistradoEnMes(filas, idPlantilla, fecha) {
  return gastosDePlantillaEnMes(filas, idPlantilla, fecha).length > 0
}

// Suma de `monto` en CLP; ignora vacíos y valores que no son números.
export function sumaMontos(filas) {
  let total = 0
  for (const fila of filas ?? []) {
    const monto = fila?.monto
    if (monto === null || monto === undefined || monto === '') continue
    const n = Number(monto)
    if (Number.isFinite(n)) total += n
  }
  return total
}
