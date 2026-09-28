// Reglas de Facturas: subtotales, cuadre de totales, diff de líneas al editar y
// aviso de stock (sin React ni Supabase, para poder verificarlas con node).
import { formatoCLP } from './formato.js'
import { compararPendientes } from './solicitudes.js'

export const TASA_IVA = 0.19

// Diferencia aceptada en el cuadre: redondeos de la factura física.
export const TOLERANCIA_CUADRE = 1

// Campos de una línea que escribe la interfaz. id_insumo_stock y qty_stock no
// están: los llena el trigger de stock y nunca se envían.
export const CAMPOS_LINEA = ['id_insumo_proveedor', 'id_solicitud_compra', 'cantidad', 'precio_neto', 'descuento', 'subtotal']

// Valor de un input → número, o null si está vacío o no es un número. Acepta
// coma decimal ("1,5").
export function aNumero(valor) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = String(valor).trim().replace(',', '.')
  if (texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

// Quita el ruido de coma flotante (3 × 1,1 = 3,3000000000000003) antes de redondear.
const limpiar = (n) => Number(n.toFixed(6))

// cantidad × precio_neto − descuento, redondeado al peso; null si falta cantidad o precio.
export function subtotalLinea(cantidad, precioNeto, descuento = 0) {
  const c = aNumero(cantidad)
  const p = aNumero(precioNeto)
  if (c === null || p === null) return null
  const d = aNumero(descuento) ?? 0
  return Math.round(limpiar(c * p - d))
}

// Σ subtotales de las líneas; ignora los vacíos.
export function sumaSubtotales(lineas) {
  let suma = 0
  for (const linea of lineas ?? []) suma += aNumero(linea?.subtotal) ?? 0
  return limpiar(suma)
}

// "Calcular desde líneas": neto = Σ subtotales − descuento_total, IVA 19 % al peso
// y total = neto + IVA. El usuario puede corregirlos después a mano.
export function calcularTotales(lineas, descuentoTotal = 0) {
  const neto = Math.round(limpiar(sumaSubtotales(lineas) - (aNumero(descuentoTotal) ?? 0)))
  const iva = Math.round(limpiar(neto * TASA_IVA))
  return { neto_total: neto, iva, total: neto + iva }
}

// Cuadre de la cabecera contra sus líneas (solo aviso, nunca bloquea el guardado).
// diferencia = lo escrito en la factura − lo esperado. Un total vacío cuenta como 0.
// 'iva' es informativo: hay facturas con IVA redondeado distinto o exentas.
export function evaluarCuadre(cabecera, lineas) {
  const suma = sumaSubtotales(lineas)
  const neto = aNumero(cabecera?.neto_total) ?? 0
  const descuento = aNumero(cabecera?.descuento_total) ?? 0
  const iva = aNumero(cabecera?.iva) ?? 0
  const total = aNumero(cabecera?.total) ?? 0

  const resultado = (tipo, declarado, esperado, informativo = false) => {
    const diferencia = Math.round(limpiar(declarado - esperado) * 100) / 100
    return { tipo, declarado, esperado, diferencia, ok: Math.abs(diferencia) <= TOLERANCIA_CUADRE, informativo }
  }

  return [
    resultado('neto', neto, limpiar(suma - descuento)),
    resultado('total', total, limpiar(neto + iva)),
    resultado('iva', iva, Math.round(limpiar(neto * TASA_IVA)), true),
  ]
}

// Qué compara cada chequeo de evaluarCuadre, para avisos y tooltips.
export const NOMBRES_CUADRE = {
  neto: 'Neto vs. Σ subtotales − descuento',
  total: 'Total vs. neto + IVA',
  iva: 'IVA vs. 19 % del neto',
}

// La factura cuadra si no falla ningún chequeo que no sea informativo.
export function cuadra(resultados) {
  return (resultados ?? []).every((r) => r.ok || r.informativo)
}

// Diferencias que no cuadran, una por línea (tooltip del listado y CSV); '' si cuadra.
export function textoDiferencias(resultados) {
  return (resultados ?? [])
    .filter((r) => !r.ok && !r.informativo)
    .map((r) => `${NOMBRES_CUADRE[r.tipo]}: diferencia ${formatoCLP(r.diferencia)}`)
    .join('\n')
}

// Qué suma al stock una línea vinculada: cantidad × cantidad_formato (vacío = 1),
// igual que el trigger. null si la cantidad no es un número.
export function stockQueSuma(cantidad, cantidadFormato) {
  const c = aNumero(cantidad)
  if (c === null) return null
  return limpiar(c * (aNumero(cantidadFormato) ?? 1))
}

const esVacio = (v) => v === null || v === undefined || v === ''

// Igualdad tolerante a tipos: 2 y '2' son iguales; '' y null también.
function mismoValor(a, b) {
  if (esVacio(a) || esVacio(b)) return esVacio(a) && esVacio(b)
  const na = aNumero(a)
  const nb = aNumero(b)
  if (na !== null && nb !== null) return na === nb
  return String(a) === String(b)
}

// '' se guarda como null (ej. una solicitud quitada de la línea).
const valorGuardable = (v) => (esVacio(v) ? null : v)
const soloCampos = (linea) => Object.fromEntries(CAMPOS_LINEA.map((c) => [c, valorGuardable(linea?.[c])]))

// Cambios a aplicar al editar una factura. `originales` son las líneas guardadas
// (con id) y `actuales` las del formulario (con id si ya existían). Al actualizar
// se envían solo los campos que cambiaron: mandar id_solicitud_compra sin cambios
// volvería a disparar el trigger que marca la solicitud como 'Comprada'.
export function diffLineas(originales, actuales) {
  const porId = new Map((originales ?? []).map((o) => [o.id, o]))
  const conservadas = new Set()
  const actualizar = []
  const insertar = []

  for (const linea of actuales ?? []) {
    const original = linea?.id ? porId.get(linea.id) : undefined
    if (!original || conservadas.has(linea.id)) {
      insertar.push(soloCampos(linea))
      continue
    }
    conservadas.add(linea.id)
    const cambios = {}
    for (const campo of CAMPOS_LINEA) {
      if (!mismoValor(original[campo], linea[campo])) cambios[campo] = valorGuardable(linea[campo])
    }
    if (Object.keys(cambios).length > 0) actualizar.push({ id: linea.id, datos: cambios })
  }

  const eliminar = [...porId.keys()].filter((id) => !conservadas.has(id))
  return { eliminar, actualizar, insertar }
}

// ---------------------------------------------------------------------------
// Estado del formulario: las líneas se editan como texto (valores de inputs).

const textoNumero = (n) => (n === null || n === undefined ? '' : String(n))
const textoSubtotal = (l) => textoNumero(subtotalLinea(l.cantidad, l.precio_neto, l.descuento))

export function lineaVacia(clave) {
  return {
    clave,
    id_insumo_proveedor: '',
    id_solicitud_compra: '',
    cantidad: '',
    precio_neto: '',
    descuento: '0',
    subtotal: '',
    subtotalManual: false,
  }
}

// Línea guardada → línea editable. Si el subtotal guardado no es el calculado,
// se trata como escrito a mano para no pisarlo al editar otro campo.
export function lineaDesdeBase(fila) {
  const linea = {
    clave: fila.id,
    id: fila.id,
    id_insumo_proveedor: fila.id_insumo_proveedor ?? '',
    id_solicitud_compra: fila.id_solicitud_compra ?? '',
    cantidad: textoNumero(fila.cantidad),
    precio_neto: textoNumero(fila.precio_neto),
    descuento: textoNumero(fila.descuento ?? 0),
    subtotal: textoNumero(fila.subtotal),
  }
  return { ...linea, subtotalManual: !mismoValor(linea.subtotal, textoSubtotal(linea)) }
}

// Cambia un campo de la línea. El subtotal se recalcula solo hasta que el usuario
// lo escribe a mano; desde ahí se respeta hasta que pida recalcular.
export function aplicarCambioLinea(linea, campo, valor) {
  if (campo === 'subtotal') return { ...linea, subtotal: valor, subtotalManual: true }
  const nueva = { ...linea, [campo]: valor }
  return nueva.subtotalManual ? nueva : { ...nueva, subtotal: textoSubtotal(nueva) }
}

export function recalcularSubtotal(linea) {
  return { ...linea, subtotalManual: false, subtotal: textoSubtotal(linea) }
}

// Línea editable → valores para la base (solo CAMPOS_LINEA, conserva el id).
export function datosLinea(linea) {
  return {
    ...(linea.id ? { id: linea.id } : {}),
    id_insumo_proveedor: linea.id_insumo_proveedor || null,
    id_solicitud_compra: linea.id_solicitud_compra || null,
    cantidad: aNumero(linea.cantidad),
    precio_neto: aNumero(linea.precio_neto),
    descuento: aNumero(linea.descuento) ?? 0,
    subtotal: aNumero(linea.subtotal),
  }
}

// Errores de una línea ya convertida con datosLinea: { campo: mensaje }.
export function erroresLinea(datos) {
  const errores = {}
  if (!datos.id_insumo_proveedor) errores.id_insumo_proveedor = 'Elige el insumo del proveedor.'
  if (datos.cantidad === null) errores.cantidad = 'Obligatoria.'
  else if (datos.cantidad <= 0) errores.cantidad = 'Debe ser mayor que 0.'
  if (datos.precio_neto === null) errores.precio_neto = 'Obligatorio.'
  else if (datos.precio_neto < 0) errores.precio_neto = 'No puede ser negativo.'
  if (datos.descuento < 0) errores.descuento = 'No puede ser negativo.'
  if (datos.subtotal === null) errores.subtotal = 'Obligatorio.'
  else if (datos.subtotal < 0) errores.subtotal = 'No puede ser negativo.'
  return errores
}

// Cabecera editable → valores para la base; descuento vacío = 0.
export function datosCabecera(cabecera) {
  return {
    id_proveedor: cabecera.id_proveedor || null,
    numero_factura: String(cabecera.numero_factura ?? '').trim(),
    fecha: cabecera.fecha || null,
    neto_total: aNumero(cabecera.neto_total),
    descuento_total: aNumero(cabecera.descuento_total) ?? 0,
    iva: aNumero(cabecera.iva),
    total: aNumero(cabecera.total),
  }
}

// Errores de la cabecera ya convertida con datosCabecera: { campo: mensaje }.
export function erroresCabecera(datos) {
  const errores = {}
  if (!datos.id_proveedor) errores.id_proveedor = 'Elige o crea el proveedor.'
  if (!datos.numero_factura) errores.numero_factura = 'Obligatorio.'
  if (!datos.fecha) errores.fecha = 'Obligatoria.'
  for (const campo of ['neto_total', 'iva', 'total']) {
    if (datos[campo] === null) errores[campo] = 'Obligatorio.'
    else if (datos[campo] < 0) errores[campo] = 'No puede ser negativo.'
  }
  if (datos.descuento_total < 0) errores.descuento_total = 'No puede ser negativo.'
  return errores
}

// Aviso de stock por línea: qué hará el trigger al guardar.
// `original` es la línea guardada (null si es nueva). Si no cambian ni el insumo
// ni la cantidad, el trigger conserva lo ya aplicado (aunque el vínculo haya
// cambiado después: vincular no aplica stock retroactivo).
// → null (sin insumo elegido) o { tipo, qty, idInsumo, revierte }:
//   'aplicado' (ya sumó qty), 'no-aplicado' (se guardó sin vínculo),
//   'suma' (sumará qty) o 'sin-vinculo' (no sumará); `revierte` = lo que se
//   descuenta de lo aplicado antes, si la línea cambia.
export function efectoStock({ idInsumoProveedor, cantidad, cantidadFormato, idInsumoOkima }, original = null) {
  if (!idInsumoProveedor) return null
  const sinCambios =
    original && original.id_insumo_proveedor === idInsumoProveedor && mismoValor(original.cantidad, cantidad)
  if (sinCambios) {
    return original.id_insumo_stock
      ? { tipo: 'aplicado', qty: aNumero(original.qty_stock), idInsumo: original.id_insumo_stock, revierte: null }
      : { tipo: 'no-aplicado', qty: null, idInsumo: null, revierte: null }
  }
  const revierte = original?.id_insumo_stock ? aNumero(original.qty_stock) : null
  if (!idInsumoOkima) return { tipo: 'sin-vinculo', qty: null, idInsumo: null, revierte }
  return { tipo: 'suma', qty: stockQueSuma(cantidad, cantidadFormato), idInsumo: idInsumoOkima, revierte }
}

// Solicitudes pendientes para el selector de una línea: primero las del insumo
// Okima vinculado a ese insumo_proveedor; dentro de cada grupo, el orden de la
// lista de pendientes (urgencia, fecha tope, antigüedad).
export function ordenarSolicitudesParaLinea(solicitudes, idInsumoOkima) {
  return [...(solicitudes ?? [])].sort((a, b) => {
    if (idInsumoOkima) {
      const pa = a.id_insumo_okima === idInsumoOkima ? 0 : 1
      const pb = b.id_insumo_okima === idInsumoOkima ? 0 : 1
      if (pa !== pb) return pa - pb
    }
    return compararPendientes(a, b)
  })
}
