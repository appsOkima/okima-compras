// Reglas de presentación de los pagos de facturas y boletas (sin React ni Supabase,
// para poder verificarlas con node). El estado de pago real lo calcula la vista
// vista_estado_pago; aquí se repite la misma regla para el panel de un documento,
// donde se ve al instante tras agregar un pago.
import { estaAnulado } from './anulacion.js'
import { formatoCLP } from './formato.js'
import { aNumeroDesdeTexto } from './numero.js'

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

// Los valores de la base llegan como número JSON o como texto con punto decimal (numeric).
function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

// `monto` es el texto del input (formato chileno, ver numero.js) y `fecha` 'YYYY-MM-DD'.
// → { valido, errores: { monto?, fecha? }, datos: { monto, fecha_pago } }.
export function validarPago({ monto, fecha }) {
  const errores = {}
  const n = aNumeroDesdeTexto(monto)
  if (n === null) errores.monto = 'Ingresa el monto del pago.'
  else if (n <= 0) errores.monto = 'El monto debe ser mayor que 0.'
  if (!FECHA_ISO.test(String(fecha ?? ''))) errores.fecha = 'Indica la fecha del pago.'
  return { valido: Object.keys(errores).length === 0, errores, datos: { monto: n, fecha_pago: fecha } }
}

// Misma regla que vista_estado_pago: pagado si lo pagado cubre el total (incluye total 0 y
// el sobrepago), pendiente si no hay nada pagado, parcial en otro caso.
function estadoDePago(total, pagado) {
  if (pagado >= total) return 'pagado'
  return pagado === 0 ? 'pendiente' : 'parcial'
}

// Resumen de un documento: `pagos` = [{ monto }]. Un sobrepago queda 'pagado' con saldo negativo.
export function saldoDe(total, pagos) {
  const t = numero(total)
  const pagado = (pagos ?? []).reduce((suma, p) => suma + numero(p?.monto), 0)
  return { total: t, pagado, saldo: t - pagado, estado: estadoDePago(t, pagado), sobrepago: pagado > t }
}

// Texto de aviso si `nuevoMonto` deja lo pagado por sobre el total; null si no hay exceso.
export function avisoSobrepago(total, pagadoActual, nuevoMonto) {
  const t = numero(total)
  const despues = numero(pagadoActual) + numero(nuevoMonto)
  if (despues <= t) return null
  return `Con este pago lo pagado sería ${formatoCLP(despues)}, ${formatoCLP(despues - t)} más que el total del documento (${formatoCLP(t)}).`
}

// Monto que se propone al abrir el formulario: lo que falta por pagar, si queda algo.
export function montoSugerido(total, pagado) {
  const saldo = numero(total) - numero(pagado)
  return saldo > 0 ? saldo : null
}

// La base no impide pagar un documento anulado: lo impide la interfaz.
export const puedeAgregarPago = (documento) => !estaAnulado(documento)

// Filas de vista_estado_pago → Map(id_documento → fila), para el listado.
export function estadosPorDocumento(filas) {
  return new Map((filas ?? []).map((f) => [f.id_documento, f]))
}

const ETIQUETAS_ESTADO = { pagado: 'Pagado', pendiente: 'Pendiente', parcial: 'Parcial', anulado: 'Anulado' }

// Texto del estado de pago de una fila de la vista (también el del CSV).
export function textoEstadoPago(fila) {
  const base = ETIQUETAS_ESTADO[fila?.estado_pago] ?? ''
  return base && fila.estado_pago === 'pagado' && numero(fila.saldo) < 0 ? `${base} (sobrepago)` : base
}

// De qué documento es un pago con `factura:facturas(…, proveedor:proveedores(nombre))` y
// `boleta:boletas(concepto, …)` embebidos → { tipo, texto, anulado }.
export function documentoDePago(pago) {
  if (pago?.factura) {
    const f = pago.factura
    const proveedor = f.proveedor?.nombre
    return {
      tipo: 'factura',
      texto: `Factura N° ${f.numero_factura}${proveedor ? ` — ${proveedor}` : ''}`,
      anulado: estaAnulado(f),
    }
  }
  const b = pago?.boleta
  return { tipo: 'boleta', texto: `Boleta${b?.concepto ? ` — ${b.concepto}` : ''}`, anulado: estaAnulado(b) }
}

// Suma de pagos sin los de documentos anulados (no cuentan, como en el Resumen).
export const totalPagosVigentes = (pagos) =>
  (pagos ?? []).reduce((suma, p) => (documentoDePago(p).anulado ? suma : suma + numero(p.monto)), 0)

// Borrar una factura o boleta con pagos falla por la FK (23503, sin cascade a propósito).
// Devuelve el mensaje accionable en ese caso y null en cualquier otro (mensajeError decide).
export function mensajeBorradoDocumento(error) {
  if (error?.code !== '23503') return null
  return 'Tiene pagos registrados: anula el documento, o elimina primero sus pagos desde Cuotas/Pagos (solo administrador).'
}

// Pago único que se registra al crear un documento "Pagado al contado": por el total
// guardado y a la fecha del documento. `total` puede venir como número o como texto de la
// base. null si el total no es > 0 (el CHECK de pagos lo rechazaría; no es un error).
export function pagoAlContado(tipo, idDocumento, total, fecha) {
  const monto = numero(total)
  if (monto <= 0) return null
  const columna = tipo === 'boleta' ? 'id_boleta' : 'id_factura'
  return { [columna]: idDocumento, monto, fecha_pago: fecha, notas: 'Pago al contado' }
}

// Texto sobre el pago para el mensaje de resultado de un documento recién creado.
// `pago` es lo que devolvió pagoAlContado (null si no hubo); `motivoError` solo si el
// insert del pago falló (el documento ya estaba guardado).
export function mensajePagoCreacion({ alContado, pago, motivoError }) {
  if (!alContado) return 'Queda pendiente de pago.'
  if (!pago) return ''
  if (motivoError) {
    return `El documento se guardó pero no se pudo registrar el pago (motivo: ${motivoError}); regístralo desde Cuotas/Pagos.`
  }
  return `Pago registrado por ${formatoCLP(pago.monto)}.`
}
