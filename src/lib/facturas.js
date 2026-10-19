// Reglas de Facturas: subtotales y totales calculados, diff de líneas al editar,
// aviso de stock y vínculo del insumo del proveedor desde la solicitud (sin React
// ni Supabase, para poder verificarlas con node).
// Los inputs numéricos muestran formato chileno (1.234,5, ver lib/numero): lo
// escrito se lee con aNumero y lo que viene de la base con numeroDesdeBase (ahí
// el punto es decimal), para que '1234.5' de la base nunca se lea como 12.345.
import { normalizarNotas } from './notas.js'
import { aNumeroDesdeTexto, numeroAEditable, numeroDesdeBase } from './numero.js'
import { compararPendientes } from './solicitudes.js'
import { factorPorDefecto } from './vinculos.js'

export const TASA_IVA = 0.19

// Campos de una línea que escribe la interfaz. subtotal no se ingresa: se calcula
// (ver subtotalLinea). El stock no es un campo de la línea: lo mueve el trigger
// (movimientos_stock) y nunca se envía.
export const CAMPOS_LINEA = ['id_insumo_proveedor', 'id_solicitud_compra', 'cantidad', 'precio_neto', 'descuento_pct', 'subtotal']

// Valor de un input (formato chileno: "1.234,5") o un Number → número, o null si
// está vacío o no es un número. El punto es de miles; los decimales van con coma.
export function aNumero(valor) {
  return aNumeroDesdeTexto(valor)
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

// Subtotal de una línea del formulario (o ya convertida a números), calculado
// desde sus campos.
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

// Qué suma al stock de un insumo Okima una línea vinculada: cantidad × factor de
// conversión del vínculo, igual que el trigger. null si la cantidad no es un
// número. `cantidad` es la del input; `factor`, el del vínculo (de la base).
export function stockQueSuma(cantidad, factor) {
  const c = aNumero(cantidad)
  if (c === null) return null
  return limpiar(c * (numeroDesdeBase(factor) ?? 1))
}

const esVacio = (v) => v === null || v === undefined || v === ''

// Igualdad tolerante a tipos entre un valor guardado (`deBase`, ej. 2 o '1234.5')
// y uno del formulario (`actual`, ej. '2' o '1.234,5'); '' y null también son iguales.
function mismoValor(deBase, actual) {
  if (esVacio(deBase) || esVacio(actual)) return esVacio(deBase) && esVacio(actual)
  const na = numeroDesdeBase(deBase)
  const nb = aNumero(actual)
  if (na !== null && nb !== null) return na === nb
  return String(deBase) === String(actual)
}

// '' se guarda como null (ej. una solicitud quitada de la línea).
const valorGuardable = (v) => (esVacio(v) ? null : v)
const soloCampos = (linea, campos) => Object.fromEntries(campos.map((c) => [c, valorGuardable(linea?.[c])]))

// Cambios a aplicar al editar una factura. `originales` son las líneas guardadas
// (con id) y `actuales` las del formulario (con id si ya existían). Al actualizar
// se envían solo los campos que cambiaron: mandar id_solicitud_compra sin cambios
// volvería a disparar el trigger que marca la solicitud como 'Comprada'.
// `campos` son los de la línea (los de factura por defecto; Boletas pasa los suyos).
export function diffLineas(originales, actuales, campos = CAMPOS_LINEA) {
  const porId = new Map((originales ?? []).map((o) => [o.id, o]))
  const conservadas = new Set()
  const actualizar = []
  const insertar = []

  for (const linea of actuales ?? []) {
    const original = linea?.id ? porId.get(linea.id) : undefined
    if (!original || conservadas.has(linea.id)) {
      insertar.push(soloCampos(linea, campos))
      continue
    }
    conservadas.add(linea.id)
    const cambios = {}
    for (const campo of campos) {
      if (!mismoValor(original[campo], linea[campo])) cambios[campo] = valorGuardable(linea[campo])
    }
    if (Object.keys(cambios).length > 0) actualizar.push({ id: linea.id, datos: cambios })
  }

  const eliminar = [...porId.keys()].filter((id) => !conservadas.has(id))
  return { eliminar, actualizar, insertar }
}

// ---------------------------------------------------------------------------
// Estado del formulario: las líneas se editan como texto (valores de inputs). El
// subtotal no es parte del estado: se calcula al mostrar y al guardar. `vinculo`
// es la decisión del usuario sobre vincular el insumo del proveedor con el insumo
// Okima de la solicitud (ver vinculoPropuesto): null (sin decidir) o
// { acepta, idInsumoProveedor, idInsumoOkima }. `factorVinculo` es el factor de
// conversión que el usuario escribió para ese vínculo (null = el por defecto).
// Ninguno de los dos se guarda en la línea.

// Descuento % guardado → texto del input (1.234,5). Un descuento 0 se muestra
// vacío (el input tiene placeholder 0). Sirve para la línea y la cabecera.
export const descuentoEditable = (n) => (numeroDesdeBase(n) ? numeroAEditable(n) : '')

export function lineaVacia(clave) {
  return {
    clave,
    id_insumo_proveedor: '',
    id_solicitud_compra: '',
    cantidad: '',
    precio_neto: '',
    descuento_pct: '',
    vinculo: null,
    factorVinculo: null,
  }
}

// Línea guardada → línea editable.
export function lineaDesdeBase(fila) {
  return {
    clave: fila.id,
    id: fila.id,
    id_insumo_proveedor: fila.id_insumo_proveedor ?? '',
    id_solicitud_compra: fila.id_solicitud_compra ?? '',
    cantidad: numeroAEditable(fila.cantidad),
    precio_neto: numeroAEditable(fila.precio_neto),
    descuento_pct: descuentoEditable(fila.descuento_pct),
    vinculo: null,
    factorVinculo: null,
  }
}

// Cambiar el insumo del proveedor o la solicitud anula la decisión de vincular y
// el factor escrito: la pregunta pasa a ser otra.
export function aplicarCambioLinea(linea, campo, valor) {
  const reinicia = (campo === 'id_insumo_proveedor' || campo === 'id_solicitud_compra') && linea[campo] !== valor
  return { ...linea, [campo]: valor, ...(reinicia ? { vinculo: null, factorVinculo: null } : {}) }
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
    notas: normalizarNotas(cabecera.notas),
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

// Stock ya aplicado a una línea guardada (movimientos_stock embebidos) →
// [{ qty, nombre }].
const movimientosAplicados = (original) =>
  (original?.movimientos ?? []).map((m) => ({ qty: numeroDesdeBase(m.qty), nombre: m.insumo?.nombre ?? '' }))

// Aviso de stock por línea: qué hará el trigger al guardar. Cada vínculo del
// insumo del proveedor genera un movimiento (cantidad × factor) a su insumo Okima.
// `vinculos` = [{ nombre, factor, pendiente? }]: los guardados más los aceptados en
// este formulario que se aplicarán al guardar (`pendiente`).
// `original` es la línea guardada (null si es nueva). Si no cambian ni el insumo
// ni la cantidad, el trigger conserva lo ya aplicado (aunque el vínculo haya
// cambiado después: vincular no aplica stock retroactivo).
// → null (sin insumo elegido) o { tipo, movimientos: [{ nombre, qty, pendiente }],
//   revierte: [{ nombre, qty }] }: 'aplicado' (ya sumó), 'no-aplicado' (se guardó
//   sin vínculos), 'suma' (sumará) o 'sin-vinculo' (no sumará); `revierte` = lo que
//   se descuenta de lo aplicado antes, si la línea cambia.
export function efectoStock({ idInsumoProveedor, cantidad, vinculos = [] }, original = null) {
  if (!idInsumoProveedor) return null
  const aplicados = movimientosAplicados(original)
  const sinCambios =
    original && original.id_insumo_proveedor === idInsumoProveedor && mismoValor(original.cantidad, cantidad)
  if (sinCambios) {
    return aplicados.length > 0
      ? { tipo: 'aplicado', movimientos: aplicados, revierte: [] }
      : { tipo: 'no-aplicado', movimientos: [], revierte: [] }
  }
  if (vinculos.length === 0) return { tipo: 'sin-vinculo', movimientos: [], revierte: aplicados }
  const movimientos = vinculos.map((v) => ({
    nombre: v.nombre,
    qty: stockQueSuma(cantidad, v.factor),
    pendiente: Boolean(v.pendiente),
  }))
  return { tipo: 'suma', movimientos, revierte: aplicados }
}

// ---------------------------------------------------------------------------
// Vínculo insumo_proveedor → insumo Okima desde la solicitud. Una línea asociada a
// una solicitud ya dice de qué insumo Okima se trata: si su insumo del proveedor
// no tiene ningún vínculo, se propone vincularlo (con su factor de conversión),
// solo con confirmación explícita del usuario (nunca en silencio; nunca al crear el
// insumo al vuelo). El vínculo se aplica al guardar, antes de las líneas, para que
// las nuevas ya muevan stock. `item.vinculos` son las filas de la pivote
// ({ id_insumo_okima, factor_conversion, insumo: { nombre } }).

// Busca por id en un Map o en un arreglo de registros con `id`.
function buscar(coleccion, id) {
  if (!coleccion || !id) return undefined
  if (coleccion instanceof Map) return coleccion.get(id)
  return coleccion.find((r) => r.id === id)
}

const nombreInsumoSolicitud = (s) => s?.insumo_nombre ?? s?.insumo?.nombre ?? ''

// Decisión de la línea, solo si sigue siendo sobre el mismo par (defensivo: al
// cambiar insumo o solicitud ya se anula, ver aplicarCambioLinea).
function decisionVigente(linea, idInsumoOkima) {
  const v = linea?.vinculo
  if (!v || v.idInsumoProveedor !== linea.id_insumo_proveedor || v.idInsumoOkima !== idInsumoOkima) return null
  return v.acepta ? 'aceptado' : 'rechazado'
}

// Vínculo aceptado de una línea, o null.
function vinculoAceptado(linea) {
  const v = linea?.vinculo
  return v?.acepta && v.idInsumoProveedor === linea.id_insumo_proveedor ? v : null
}

// Factor del vínculo de una línea, como texto de input: el escrito o el por defecto
// (cantidad por formato del insumo del proveedor, o 1).
const factorEditable = (linea, item) => linea.factorVinculo ?? numeroAEditable(factorPorDefecto(item.cantidad_formato))

// Qué mostrar en la línea sobre el vínculo. `catalogo` y `solicitudes` pueden ser
// Map o arreglo.
// → { tipo: 'ninguno' }
//   { tipo: 'proponer', idInsumoProveedor, idInsumoOkima, nombreInsumoProveedor,
//     nombreInsumoOkima, factor, decision: null | 'aceptado' | 'rechazado' }
//   { tipo: 'ya-vinculado', nombreVinculado, nombreInsumoOkima }: ya tiene vínculos
//     pero ninguno al insumo de la solicitud (solo aviso; aquí no se re-vincula).
export function vinculoPropuesto(linea, catalogo, solicitudes) {
  const ninguno = { tipo: 'ninguno' }
  if (!linea?.id_insumo_proveedor || !linea?.id_solicitud_compra) return ninguno
  const item = buscar(catalogo, linea.id_insumo_proveedor)
  const solicitud = buscar(solicitudes, linea.id_solicitud_compra)
  const idInsumoOkima = solicitud?.id_insumo_okima
  // Catálogo o solicitudes aún cargando: no se propone nada todavía.
  if (!item || !idInsumoOkima) return ninguno
  const nombreInsumoOkima = nombreInsumoSolicitud(solicitud)

  const vinculos = item.vinculos ?? []
  if (vinculos.length > 0) {
    if (vinculos.some((v) => v.id_insumo_okima === idInsumoOkima)) return ninguno
    return {
      tipo: 'ya-vinculado',
      nombreVinculado: vinculos.map((v) => v.insumo?.nombre ?? '').join(', '),
      nombreInsumoOkima,
    }
  }

  return {
    tipo: 'proponer',
    idInsumoProveedor: item.id,
    idInsumoOkima,
    nombreInsumoProveedor: item.nombre,
    nombreInsumoOkima,
    factor: factorEditable(linea, item),
    decision: decisionVigente(linea, idInsumoOkima),
  }
}

// Registra en la línea la decisión sobre la propuesta ('proponer') que se le mostró.
export function decidirVinculo(linea, propuesta, acepta) {
  return {
    ...linea,
    vinculo: { acepta: Boolean(acepta), idInsumoProveedor: propuesta.idInsumoProveedor, idInsumoOkima: propuesta.idInsumoOkima },
  }
}

// Vínculos aceptados a aplicar al guardar, uno por par insumo del proveedor ↔
// insumo Okima (vale la primera línea que lo aceptó) y solo si el insumo del
// proveedor sigue sin ningún vínculo en el catálogo cargado. `factor` es un número
// (null si lo escrito no es un número: el formulario lo rechaza con validarFactor).
// → [{ idInsumoProveedor, idInsumoOkima, factor, nombreInsumoProveedor, nombreInsumoOkima }]
export function vinculosAAplicar(lineas, catalogo, solicitudes) {
  const porPar = new Map()
  for (const linea of lineas ?? []) {
    const v = vinculoAceptado(linea)
    if (!v) continue
    const clave = `${v.idInsumoProveedor}|${v.idInsumoOkima}`
    if (porPar.has(clave)) continue
    const item = buscar(catalogo, v.idInsumoProveedor)
    const solicitud = buscar(solicitudes, linea.id_solicitud_compra)
    if (!item || (item.vinculos ?? []).length > 0 || solicitud?.id_insumo_okima !== v.idInsumoOkima) continue
    porPar.set(clave, {
      idInsumoProveedor: v.idInsumoProveedor,
      idInsumoOkima: v.idInsumoOkima,
      factor: aNumero(factorEditable(linea, item)),
      nombreInsumoProveedor: item.nombre,
      nombreInsumoOkima: nombreInsumoSolicitud(solicitud),
    })
  }
  return [...porPar.values()]
}

// Solicitudes pendientes para el selector de una línea: primero las de los
// insumos Okima vinculados a ese insumo_proveedor (`idsInsumoOkima`, puede haber
// varios); dentro de cada grupo, el orden de la lista de pendientes (urgencia,
// fecha tope, antigüedad).
export function ordenarSolicitudesParaLinea(solicitudes, idsInsumoOkima = []) {
  const ids = new Set(idsInsumoOkima)
  return [...(solicitudes ?? [])].sort((a, b) => {
    if (ids.size > 0) {
      const pa = ids.has(a.id_insumo_okima) ? 0 : 1
      const pb = ids.has(b.id_insumo_okima) ? 0 : 1
      if (pa !== pb) return pa - pb
    }
    return compararPendientes(a, b)
  })
}

// ---------------------------------------------------------------------------
// Aviso de factura duplicada mientras se escribe, y precio de catálogo.

// Combinación proveedor + N° de factura a comprobar contra la base, o null si no
// hay nada que comprobar (falta uno de los dos) o ya se comprobó (`comprobadas` es
// un Set de claves), para no avisar dos veces por lo mismo. El número se compara
// sin espacios de los bordes, como se guarda (ver datosCabecera).
export function claveDuplicado(idProveedor, numeroFactura, comprobadas = new Set()) {
  const numero = String(numeroFactura ?? '').trim()
  if (!idProveedor || !numero) return null
  const clave = `${idProveedor}|${numero}`
  if (comprobadas.has(clave)) return null
  return { clave, idProveedor, numero }
}

// Actualizaciones del precio de catálogo (insumos_proveedores.precio_clp) a partir
// de las líneas ya convertidas con datosLinea: si el precio_neto de la línea difiere
// del precio_clp del catálogo (null cuenta como distinto), se fija con la fecha de
// la factura, salvo que el catálogo ya tenga una fecha posterior. Con varias líneas
// del mismo insumo vale la última. `catalogo` es un Map o arreglo de registros.
// → [{ id, precio_clp, fecha_actualizacion }]
export function actualizacionesPrecio(lineas, catalogo, fechaFactura) {
  if (!fechaFactura) return []
  const ultimas = new Map()
  for (const l of lineas ?? []) {
    if (l?.id_insumo_proveedor && typeof l.precio_neto === 'number') ultimas.set(l.id_insumo_proveedor, l.precio_neto)
  }
  const resultado = []
  for (const [id, precio] of ultimas) {
    const item = buscar(catalogo, id)
    if (!item) continue
    if (numeroDesdeBase(item.precio_clp) === precio) continue
    if (item.fecha_actualizacion && String(item.fecha_actualizacion) > fechaFactura) continue
    resultado.push({ id, precio_clp: precio, fecha_actualizacion: fechaFactura })
  }
  return resultado
}
