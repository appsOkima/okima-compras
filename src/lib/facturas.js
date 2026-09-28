// Reglas de Facturas: subtotales y totales calculados, diff de líneas al editar y
// aviso de stock (sin React ni Supabase, para poder verificarlas con node).
import { compararPendientes } from './solicitudes.js'

export const TASA_IVA = 0.19

// Campos de una línea que escribe la interfaz. subtotal no se ingresa: se calcula
// (ver subtotalLinea). id_insumo_stock y qty_stock no están: los llena el
// trigger de stock y nunca se envían.
export const CAMPOS_LINEA = ['id_insumo_proveedor', 'id_solicitud_compra', 'cantidad', 'precio_neto', 'descuento_pct', 'subtotal']

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

// Aplica un descuento en % (vacío = 0) a un monto.
const conDescuento = (monto, descuentoPct) => monto * (1 - (aNumero(descuentoPct) ?? 0) / 100)

// cantidad × precio_neto × (1 − descuento_pct / 100), redondeado al peso; null si
// falta cantidad o precio.
export function subtotalLinea(cantidad, precioNeto, descuentoPct = 0) {
  const c = aNumero(cantidad)
  const p = aNumero(precioNeto)
  if (c === null || p === null) return null
  return Math.round(limpiar(conDescuento(c * p, descuentoPct)))
}

// Subtotal de una línea (del formulario o de la base), calculado desde sus campos.
export const subtotalDe = (linea) => subtotalLinea(linea?.cantidad, linea?.precio_neto, linea?.descuento_pct)

// Σ subtotales de las líneas; las que no tienen cantidad o precio cuentan 0.
export function sumaSubtotales(lineas) {
  let suma = 0
  for (const linea of lineas ?? []) suma += subtotalDe(linea) ?? 0
  return suma
}

// Totales de la factura, siempre calculados (el usuario solo ingresa el descuento
// global en %): neto = Σ subtotales × (1 − descuento_pct / 100) al peso, IVA 19 %
// al peso y total = neto + IVA. montoDescuento = lo que resta el descuento global.
export function calcularTotales(lineas, descuentoPct = 0) {
  const suma = sumaSubtotales(lineas)
  const neto = Math.round(limpiar(conDescuento(suma, descuentoPct)))
  const iva = Math.round(limpiar(neto * TASA_IVA))
  return { sumaSubtotales: suma, neto_total: neto, iva, total: neto + iva, montoDescuento: suma - neto }
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
// Estado del formulario: las líneas se editan como texto (valores de inputs). El
// subtotal no es parte del estado: se calcula al mostrar y al guardar.

const textoNumero = (n) => (n === null || n === undefined ? '' : String(n))
// Un descuento 0 se muestra vacío (el input tiene placeholder 0).
const textoDescuento = (n) => (aNumero(n) ? String(n) : '')

export function lineaVacia(clave) {
  return {
    clave,
    id_insumo_proveedor: '',
    id_solicitud_compra: '',
    cantidad: '',
    precio_neto: '',
    descuento_pct: '',
  }
}

// Línea guardada → línea editable.
export function lineaDesdeBase(fila) {
  return {
    clave: fila.id,
    id: fila.id,
    id_insumo_proveedor: fila.id_insumo_proveedor ?? '',
    id_solicitud_compra: fila.id_solicitud_compra ?? '',
    cantidad: textoNumero(fila.cantidad),
    precio_neto: textoNumero(fila.precio_neto),
    descuento_pct: textoDescuento(fila.descuento_pct),
  }
}

export function aplicarCambioLinea(linea, campo, valor) {
  return { ...linea, [campo]: valor }
}

// Línea editable → valores para la base (solo CAMPOS_LINEA, conserva el id).
// Descuento vacío = 0; el subtotal se calcula.
export function datosLinea(linea) {
  const descuentoPct = aNumero(linea.descuento_pct) ?? 0
  return {
    ...(linea.id ? { id: linea.id } : {}),
    id_insumo_proveedor: linea.id_insumo_proveedor || null,
    id_solicitud_compra: linea.id_solicitud_compra || null,
    cantidad: aNumero(linea.cantidad),
    precio_neto: aNumero(linea.precio_neto),
    descuento_pct: descuentoPct,
    subtotal: subtotalLinea(linea.cantidad, linea.precio_neto, descuentoPct),
  }
}

const ERROR_PORCENTAJE = 'Debe estar entre 0 y 100.'
const porcentajeValido = (n) => n >= 0 && n <= 100

// Errores de una línea ya convertida con datosLinea: { campo: mensaje }.
export function erroresLinea(datos) {
  const errores = {}
  if (!datos.id_insumo_proveedor) errores.id_insumo_proveedor = 'Elige el insumo del proveedor.'
  if (datos.cantidad === null) errores.cantidad = 'Obligatoria.'
  else if (datos.cantidad <= 0) errores.cantidad = 'Debe ser mayor que 0.'
  if (datos.precio_neto === null) errores.precio_neto = 'Obligatorio.'
  else if (datos.precio_neto < 0) errores.precio_neto = 'No puede ser negativo.'
  if (!porcentajeValido(datos.descuento_pct)) errores.descuento_pct = ERROR_PORCENTAJE
  return errores
}

// Cabecera editable + líneas del formulario → valores para la base. Descuento
// vacío = 0; neto, IVA y total se calculan desde las líneas (calcularTotales).
export function datosCabecera(cabecera, lineas) {
  const descuentoPct = aNumero(cabecera.descuento_pct) ?? 0
  const { neto_total, iva, total } = calcularTotales(lineas, descuentoPct)
  return {
    id_proveedor: cabecera.id_proveedor || null,
    numero_factura: String(cabecera.numero_factura ?? '').trim(),
    fecha: cabecera.fecha || null,
    descuento_pct: descuentoPct,
    neto_total,
    iva,
    total,
  }
}

// Errores de la cabecera ya convertida con datosCabecera: { campo: mensaje }.
export function erroresCabecera(datos) {
  const errores = {}
  if (!datos.id_proveedor) errores.id_proveedor = 'Elige o crea el proveedor.'
  if (!datos.numero_factura) errores.numero_factura = 'Obligatorio.'
  if (!datos.fecha) errores.fecha = 'Obligatoria.'
  if (!porcentajeValido(datos.descuento_pct)) errores.descuento_pct = ERROR_PORCENTAJE
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
