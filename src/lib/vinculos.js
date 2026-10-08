// Reglas de los vínculos insumo del proveedor ↔ insumo Okima (pivote N:M
// insumos_proveedores_okima), sin React ni Supabase para poder verificarlas con
// node. factor_conversion = unidades Okima por cada unidad que vende el proveedor.
// Lo escrito en los inputs va en formato chileno (aNumeroDesdeTexto); lo que viene
// de la base, con punto decimal (numeroDesdeBase), igual que en lib/facturas.
import { formatoNumero } from './formato.js'
import { aNumeroDesdeTexto, numeroAEditable, numeroDesdeBase } from './numero.js'

// Explicación del factor, para los formularios que lo piden.
export const AYUDA_FACTOR =
  'Factor: unidades Okima por cada unidad que vende el proveedor. Ej.: si compras cajas de 12 tazas y en Okima ' +
  'las tazas se cuentan sueltas, el factor es 12; si el proveedor las vende sueltas, es 1.'

// Factor propuesto para un vínculo nuevo: la cantidad por formato del insumo del
// proveedor si es mayor que 0; si no, 1. Editable por el usuario.
export function factorPorDefecto(cantidadFormato) {
  const n = numeroDesdeBase(cantidadFormato)
  return n !== null && n > 0 ? n : 1
}

// Texto de un input de factor → mensaje de error, o null si es un número > 0.
export function validarFactor(valor) {
  const n = aNumeroDesdeTexto(valor)
  if (n === null) return 'El factor es obligatorio.'
  if (n <= 0) return 'El factor debe ser mayor que 0.'
  return null
}

// Filas editables { id_insumo_okima, factor } → primer error, o null. Un insumo
// Okima no puede repetirse (la base lo impide con UNIQUE por par).
export function validarVinculos(filas) {
  const vistos = new Set()
  for (const fila of filas ?? []) {
    if (!fila.id_insumo_okima) return 'Elige el insumo Okima de cada vínculo (o quita la fila).'
    const errorFactor = validarFactor(fila.factor)
    if (errorFactor) return errorFactor
    if (vistos.has(fila.id_insumo_okima)) return 'Un insumo Okima no puede vincularse más de una vez.'
    vistos.add(fila.id_insumo_okima)
  }
  return null
}

// Filas de la pivote (de la base) → filas editables del formulario. `clave` es el
// id de la fila guardada o, en las nuevas, un identificador local.
export function vinculosEditables(filasBase) {
  if (!Array.isArray(filasBase)) return []
  return filasBase.map((f) => ({
    clave: f.id,
    id: f.id,
    id_insumo_okima: f.id_insumo_okima,
    factor: numeroAEditable(f.factor_conversion),
  }))
}

// Cambios a aplicar en la pivote al guardar: `originales` son las filas guardadas
// y `actuales` las editables. Al actualizar se envían solo los campos cambiados.
// Se borra primero, luego se actualiza y al final se inserta (así un insumo Okima
// liberado por una fila quitada puede usarse en otra sin chocar con el UNIQUE).
export function cambiosVinculos(originales, actuales) {
  const porId = new Map((originales ?? []).map((o) => [o.id, o]))
  const conservadas = new Set()
  const insertar = []
  const actualizar = []

  for (const fila of actuales ?? []) {
    const original = fila.id ? porId.get(fila.id) : undefined
    const factor = aNumeroDesdeTexto(fila.factor)
    if (!original || conservadas.has(fila.id)) {
      insertar.push({ id_insumo_okima: fila.id_insumo_okima, factor_conversion: factor })
      continue
    }
    conservadas.add(fila.id)
    const datos = {}
    if (original.id_insumo_okima !== fila.id_insumo_okima) datos.id_insumo_okima = fila.id_insumo_okima
    if (numeroDesdeBase(original.factor_conversion) !== factor) datos.factor_conversion = factor
    if (Object.keys(datos).length > 0) actualizar.push({ id: fila.id, datos })
  }

  const eliminar = [...porId.keys()].filter((id) => !conservadas.has(id))
  return { insertar, actualizar, eliminar }
}

// "Taza × 1, Plato × 0,5" para listados y CSV; vacío si no hay vínculos.
// `vinculos` = filas de la pivote con `insumo:insumos(nombre)` embebido.
export function textoVinculos(vinculos) {
  return (vinculos ?? []).map((v) => `${v.insumo?.nombre ?? ''} × ${formatoNumero(v.factor_conversion)}`).join(', ')
}

// "+12 Taza, +0,5 Plato" con el stock que movió una línea; vacío si no movió nada.
// `movimientos` = filas de movimientos_stock con `insumo:insumos(nombre)` embebido.
export function textoMovimientos(movimientos) {
  return (movimientos ?? []).map((m) => `+${formatoNumero(m.qty)} ${m.insumo?.nombre ?? ''}`).join(', ')
}
