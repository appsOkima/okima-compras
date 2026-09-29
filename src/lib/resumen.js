// Resumen de gastos: facturas y otros gastos juntos, por mes y por centro de
// costo (sin React ni Supabase, para poder verificarlo con node).
import { mesDe } from './gastos.js'

// Valor del filtro "Centro de costo" para ver solo lo que no tiene subcategoría
// (líneas de factura sin insumo Okima vinculado, gastos sin subcategoría).
// No es un uuid, así que no choca con ningún id de categoría.
export const SIN_CENTRO = 'sin-centro'

export const ETIQUETA_SIN_CENTRO = 'Sin centro de costo'

// Los valores de la base llegan como número JSON o como texto con punto decimal
// (numeric); vacíos o no numéricos cuentan 0. Sin parseo por configuración regional.
function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

// Reparte `total` (en pesos enteros) en proporción a `pesos` con el método del
// resto mayor: cada parte queda en pesos enteros y la suma es exactamente el
// total, así el resumen cuadra con la factura sin redondear línea por línea.
// Los empates del resto se resuelven por orden de la línea (estable).
export function repartir(total, pesos) {
  const suma = pesos.reduce((s, p) => s + p, 0)
  const base = pesos.map((p) => (total * p) / suma)
  const partes = base.map(Math.floor)
  let resto = total - partes.reduce((s, p) => s + p, 0)
  const orden = base.map((b, i) => ({ i, fraccion: b - Math.floor(b) })).sort((a, b) => b.fraccion - a.fraccion || a.i - b.i)
  for (let k = 0; resto > 0 && k < orden.length; k++, resto--) partes[orden[k].i] += 1
  return partes
}

// Factura → movimientos, uno por línea: su `total` (con IVA y descuento global)
// se reparte en proporción al subtotal de cada línea. La subcategoría es la del
// insumo Okima vinculado al insumo del proveedor (null si no está vinculado).
// Sin líneas, o con subtotales que suman 0, todo el total queda sin centro de costo.
// El total se lleva a pesos enteros (ya se guarda redondeado al peso).
export function movimientosDeFactura(factura) {
  const mes = mesDe(factura?.fecha)
  const total = Math.round(numero(factura?.total))
  const lineas = factura?.lineas ?? []
  const pesos = lineas.map((l) => numero(l?.subtotal))
  const sumaPesos = pesos.reduce((s, p) => s + p, 0)
  if (lineas.length === 0 || sumaPesos <= 0) {
    return [{ mes, origen: 'factura', idSubcategoria: null, monto: total }]
  }
  const partes = repartir(total, pesos)
  return lineas.map((l, i) => ({
    mes,
    origen: 'factura',
    idSubcategoria: l?.insumo_proveedor?.insumo?.id_subcategoria ?? null,
    monto: partes[i],
  }))
}

// Otro gasto → un movimiento con su monto en su subcategoría.
export function movimientoDeGasto(gasto) {
  return {
    mes: mesDe(gasto?.fecha),
    origen: 'gasto',
    idSubcategoria: gasto?.id_subcategoria || null,
    monto: numero(gasto?.monto),
  }
}

export function movimientos(facturas, gastos) {
  return [...(facturas ?? []).flatMap(movimientosDeFactura), ...(gastos ?? []).map(movimientoDeGasto)]
}

// subcategorias = [{ id, nombre, categoria: { id, nombre } }] → Map id → datos
// planos, para ubicar cada movimiento en su categoría (centro de costo).
export function indiceSubcategorias(subcategorias) {
  const indice = new Map()
  for (const s of subcategorias ?? []) {
    if (!s?.id) continue
    indice.set(s.id, {
      id: s.id,
      nombre: s.nombre ?? '',
      idCategoria: s.categoria?.id ?? null,
      categoria: s.categoria?.nombre ?? '',
    })
  }
  return indice
}

// filtro = { mes?, idCategoria?, idSubcategoria? }; vacío = sin filtrar.
// idCategoria = SIN_CENTRO deja solo lo que no tiene subcategoría; una categoría
// incluye cualquiera de sus subcategorías.
export function filtrarMovimientos(lista, filtro = {}, indice = new Map()) {
  const { mes, idCategoria, idSubcategoria } = filtro ?? {}
  return (lista ?? []).filter((m) => {
    if (mes && m.mes !== mes) return false
    if (idCategoria === SIN_CENTRO) return m.idSubcategoria === null
    if (idCategoria && indice.get(m.idSubcategoria)?.idCategoria !== idCategoria) return false
    if (idSubcategoria && m.idSubcategoria !== idSubcategoria) return false
    return true
  })
}

function acumular(fila, m) {
  if (m.origen === 'factura') fila.facturas += m.monto
  else fila.otrosGastos += m.monto
  fila.total += m.monto
}

// Filas por mes, del más reciente al más antiguo (sin fecha al final):
// { id, mes, facturas, otrosGastos, total }.
export function resumenPorMes(lista, filtro, indice) {
  const filas = new Map()
  for (const m of filtrarMovimientos(lista, filtro, indice)) {
    const clave = m.mes ?? ''
    if (!filas.has(clave)) filas.set(clave, { id: clave || 'sin-fecha', mes: m.mes, facturas: 0, otrosGastos: 0, total: 0 })
    acumular(filas.get(clave), m)
  }
  // 'YYYY-MM' ordena igual como texto que como fecha.
  return [...filas.values()].sort((a, b) => (b.mes ?? '').localeCompare(a.mes ?? ''))
}

const compararTexto = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })

// Filas por subcategoría (agrupadas y ordenadas por categoría y luego por
// subcategoría), con "Sin centro de costo" al final:
// { id, idCategoria, categoria, idSubcategoria, subcategoria, facturas, otrosGastos, total, pct }.
// `pct` es el porcentaje sobre el total de lo filtrado (0 si ese total es 0).
export function resumenPorCentro(lista, filtro, indice = new Map()) {
  const filas = new Map()
  for (const m of filtrarMovimientos(lista, filtro, indice)) {
    const clave = m.idSubcategoria ?? SIN_CENTRO
    if (!filas.has(clave)) {
      const sub = m.idSubcategoria ? indice.get(m.idSubcategoria) : null
      filas.set(clave, {
        id: clave,
        idCategoria: m.idSubcategoria ? (sub?.idCategoria ?? null) : SIN_CENTRO,
        categoria: m.idSubcategoria ? (sub?.categoria ?? '') : ETIQUETA_SIN_CENTRO,
        idSubcategoria: m.idSubcategoria,
        subcategoria: sub?.nombre ?? '',
        facturas: 0,
        otrosGastos: 0,
        total: 0,
        pct: 0,
      })
    }
    acumular(filas.get(clave), m)
  }
  const resultado = [...filas.values()]
  const total = resultado.reduce((s, f) => s + f.total, 0)
  for (const f of resultado) f.pct = total ? (f.total / total) * 100 : 0
  return resultado.sort((a, b) => {
    const sa = a.id === SIN_CENTRO
    const sb = b.id === SIN_CENTRO
    if (sa || sb) return sa === sb ? 0 : sa ? 1 : -1
    return compararTexto(a.categoria, b.categoria) || compararTexto(a.subcategoria, b.subcategoria)
  })
}

// Suma de las columnas de monto de unas filas (línea de total bajo cada tabla).
export function totales(filas) {
  const t = { facturas: 0, otrosGastos: 0, total: 0 }
  for (const f of filas ?? []) {
    t.facturas += f.facturas
    t.otrosGastos += f.otrosGastos
    t.total += f.total
  }
  return t
}

// Meses distintos con movimientos, del más reciente al más antiguo (filtro "Mes").
export function mesesDeMovimientos(lista) {
  return [...new Set((lista ?? []).map((m) => m.mes).filter(Boolean))].sort().reverse()
}
