// Búsqueda por texto del listado de Facturas (sin React ni Supabase, para poder verificarla con node).
// Una factura coincide si el texto está en su cabecera (número, proveedor, RUT) o en alguna de sus
// líneas: nombre y código del insumo del proveedor, o nombre de un insumo Okima vinculado.
import { coincide, normalizar, normalizarRut } from './texto.js'

// Nombre con el que se muestra la línea que coincidió (el insumo del proveedor).
function nombreSiCoincide(linea, filtro) {
  const ip = linea?.insumo_proveedor
  if (!ip) return null
  const textos = [ip.nombre, ip.codigo, ...(ip.vinculos ?? []).map((v) => v?.insumo?.nombre)]
  return textos.some((t) => coincide(t, filtro)) ? (ip.nombre ?? ip.codigo ?? '') : null
}

// `lineas` lista, sin repetir, las líneas que coincidieron, y solo cuando la cabecera NO coincide
// (si ya coincide por proveedor o número no hace falta explicar por qué aparece).
export function buscarEnFactura(factura, filtro) {
  if (!normalizar(filtro)) return { coincide: true, lineas: [] }

  const cabecera = [
    factura?.proveedor?.nombre,
    factura?.numero_factura,
    factura?.proveedor?.rut,
    normalizarRut(factura?.proveedor?.rut),
  ].some((v) => coincide(v, filtro))
  if (cabecera) return { coincide: true, lineas: [] }

  const nombres = (factura?.lineas ?? []).map((l) => nombreSiCoincide(l, filtro)).filter((n) => n !== null)
  return { coincide: nombres.length > 0, lineas: [...new Set(nombres)] }
}
