// Reglas de presentación de las solicitudes de compra (sin React ni Supabase,
// para poder verificarlas con node). La extensión .js explícita es para node.
import { formatoFecha, formatoNumero } from './formato.js'
import { normalizar } from './texto.js'

// En el orden del enum nivel_urgencia de la base (Baja < Media < Alta).
export const NIVELES_URGENCIA = ['Baja', 'Media', 'Alta']

export const URGENCIA_POR_DEFECTO = 'Media'

// El símbolo acompaña siempre a la etiqueta: la urgencia se distingue aunque la
// hoja se imprima en blanco y negro. Los colores son solo para pantalla.
const URGENCIAS = {
  Alta: {
    etiqueta: 'Alta',
    simbolo: '▲',
    rango: 3,
    claseEtiqueta: 'bg-red-100 text-red-800 ring-red-600/20',
    claseFila: 'border-l-4 border-l-red-500',
    claseBoton: 'border-red-300 bg-red-50 text-red-800',
  },
  Media: {
    etiqueta: 'Media',
    simbolo: '■',
    rango: 2,
    claseEtiqueta: 'bg-amber-100 text-amber-800 ring-amber-600/20',
    claseFila: 'border-l-4 border-l-amber-400',
    claseBoton: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  Baja: {
    etiqueta: 'Baja',
    simbolo: '▽',
    rango: 1,
    claseEtiqueta: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    claseFila: 'border-l-4 border-l-emerald-300',
    claseBoton: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
}

// Valor desconocido o vacío: pastilla neutra, sin romper la tabla.
const URGENCIA_DESCONOCIDA = {
  etiqueta: 'Sin definir',
  simbolo: '·',
  rango: 0,
  claseEtiqueta: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  claseFila: '',
  claseBoton: 'border-slate-300 bg-slate-50 text-slate-700',
}

export function metaUrgencia(nivel) {
  return URGENCIAS[nivel] ?? URGENCIA_DESCONOCIDA
}

export const ESTADOS_SOLICITUD = ['Pendiente', 'Comprada', 'Cancelada']

const CLASES_ESTADO = {
  Pendiente: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  Comprada: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  Cancelada: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

// En la base el estado sigue siendo 'Cancelada'; en la interfaz se muestra "Anulada".
export function etiquetaEstado(estado) {
  return estado === 'Cancelada' ? 'Anulada' : (estado ?? '')
}

export function claseEstado(estado) {
  return CLASES_ESTADO[estado] ?? CLASES_ESTADO.Cancelada
}

// Cambio manual de estado desde el panel (etapa inicial: muchas facturas se
// ingresan sin asociar la solicitud). Cualquier estado puede pasar a cualquier
// otro; un estado desconocido ofrece los tres.
export function transicionesDisponibles(estado) {
  return ESTADOS_SOLICITUD.filter((e) => e !== estado)
}

// Nombre de la acción que lleva a cada estado (botones y confirmación).
const ACCIONES_ESTADO = {
  Pendiente: 'Volver a pendiente',
  Comprada: 'Marcar comprada',
  Cancelada: 'Anular solicitud',
}

export function accionEstado(nuevoEstado) {
  return ACCIONES_ESTADO[nuevoEstado] ?? `Pasar a ${nuevoEstado}`
}

// Solo al dejar de estar comprada (Pendiente o Cancelada) importa avisar qué
// facturas y boletas la referencian: el vínculo de la línea no se toca.
export function avisaFacturas(nuevoEstado) {
  return nuevoEstado === 'Pendiente' || nuevoEstado === 'Cancelada'
}

// Líneas de detalle_facturas con `factura:facturas(numero_factura, fecha,
// proveedor:proveedores(nombre))` → facturas distintas, como texto
// "N° 123 de Proveedor (dd-mm-aaaa)". Varias líneas de una misma factura cuentan una vez.
export function facturasDeLineas(lineas) {
  const vistas = new Map()
  for (const linea of lineas ?? []) {
    const f = linea?.factura
    if (!f) continue
    const proveedor = f.proveedor?.nombre ?? ''
    const clave = `${f.numero_factura ?? ''}|${proveedor}`
    if (vistas.has(clave)) continue
    let texto = `N° ${f.numero_factura ?? '?'}`
    if (proveedor) texto += ` de ${proveedor}`
    if (f.fecha) texto += ` (${formatoFecha(f.fecha)})`
    vistas.set(clave, texto)
  }
  return [...vistas.values()]
}

// Líneas de detalle_boletas con `boleta:boletas(id, concepto, fecha, numero_documento)` →
// boletas distintas, como texto "«Concepto» N° 12 (dd-mm-aaaa)". Varias líneas de una
// misma boleta cuentan una vez.
export function boletasDeLineas(lineas) {
  const vistas = new Map()
  for (const linea of lineas ?? []) {
    const b = linea?.boleta
    if (!b) continue
    const clave = b.id ?? `${b.concepto}|${b.fecha}|${b.numero_documento}`
    if (vistas.has(clave)) continue
    let texto = `«${b.concepto ?? '?'}»`
    if (b.numero_documento) texto += ` N° ${b.numero_documento}`
    if (b.fecha) texto += ` (${formatoFecha(b.fecha)})`
    vistas.set(clave, texto)
  }
  return [...vistas.values()]
}

const unirConY = (lista) =>
  lista.length <= 1 ? (lista[0] ?? '') : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`

// Texto del window.confirm al cambiar el estado. `solicitud` puede venir de la
// vista (insumo_nombre) o de la tabla con el insumo embebido (insumo.nombre);
// `facturas` y `boletas` son la salida de facturasDeLineas y boletasDeLineas (solo se
// mencionan al pasar a Pendiente o Anulada; avisa, no bloquea).
const PREGUNTAS_ESTADO = {
  Pendiente: 'Volver a dejar como pendiente',
  Comprada: 'Marcar como comprada',
  Cancelada: 'Anular',
}

export function textoConfirmacionEstado(solicitud, nuevoEstado, facturas = [], boletas = []) {
  const nombre = solicitud?.insumo_nombre ?? solicitud?.insumo?.nombre ?? ''
  const estado = solicitud?.estado
  const pregunta = PREGUNTAS_ESTADO[nuevoEstado] ?? `Pasar a '${etiquetaEstado(nuevoEstado)}'`
  let texto = `¿${pregunta} la solicitud de "${nombre}"? Hoy está '${estado ? etiquetaEstado(estado) : '—'}'.`
  if (nuevoEstado === 'Pendiente') texto += ' Volverá a la lista de pendientes.'
  else if (estado === 'Pendiente') texto += ' Saldrá de la lista de pendientes.'
  if (avisaFacturas(nuevoEstado)) {
    const documentos = [
      facturas?.length && `${facturas.length > 1 ? 'las facturas' : 'la factura'} ${unirConY(facturas)}`,
      boletas?.length && `${boletas.length > 1 ? 'las boletas' : 'la boleta'} ${unirConY(boletas)}`,
    ].filter(Boolean)
    if (documentos.length > 0) texto += `

Está asociada a ${documentos.join(' y a ')}; el vínculo se mantiene.`
  }
  return texto
}

// Fecha local de hoy como 'YYYY-MM-DD' (no toISOString: eso es UTC y en Chile,
// de noche, daría el día siguiente).
export function hoyISO(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

// Fecha tope frente a hoy (ambas 'YYYY-MM-DD'; en ese formato comparar texto
// equivale a comparar fechas): 'vencida', 'hoy', 'futura' o null si no hay fecha.
export function estadoFechaTope(fechaISO, hoy = hoyISO()) {
  const fecha = String(fechaISO ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  if (fecha < hoy) return 'vencida'
  if (fecha === hoy) return 'hoy'
  return 'futura'
}

export function estaVencida(fechaISO, hoy = hoyISO()) {
  return estadoFechaTope(fechaISO, hoy) === 'vencida'
}

// Mismo orden que vista_solicitudes_pendientes: urgencia (Alta → Baja), fecha tope
// (sin fecha al final) y antigüedad. Se reaplica en el navegador porque la API no
// garantiza conservar el ORDER BY de la vista y la impresión depende de él.
export function compararPendientes(a, b) {
  const porUrgencia = metaUrgencia(b.nivel_urgencia).rango - metaUrgencia(a.nivel_urgencia).rango
  if (porUrgencia !== 0) return porUrgencia
  const fa = a.fecha_esperada ?? null
  const fb = b.fecha_esperada ?? null
  if (fa !== fb) {
    if (fa === null) return 1
    if (fb === null) return -1
    return fa < fb ? -1 : 1
  }
  return (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0)
}

// Solicitantes distintos para el autocompletado: sin vacíos y sin repetir por
// mayúsculas, tildes o espacios. Se conserva la primera forma escrita (la lista
// llega de la más reciente a la más antigua) y se ordena alfabéticamente.
export function solicitantesUnicos(lista) {
  const vistos = new Map()
  for (const valor of lista ?? []) {
    const texto = String(valor ?? '').trim().replace(/\s+/g, ' ')
    const clave = normalizar(texto)
    if (clave && !vistos.has(clave)) vistos.set(clave, texto)
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

// Último solicitante usado en este navegador. localStorage puede no existir o
// lanzar error (modo privado, almacenamiento bloqueado): se ignora sin romper.
const CLAVE_SOLICITANTE = 'okima.ultimoSolicitante'

export function leerUltimoSolicitante() {
  try {
    return window.localStorage.getItem(CLAVE_SOLICITANTE) ?? ''
  } catch {
    return ''
  }
}

export function guardarUltimoSolicitante(nombre) {
  try {
    const texto = String(nombre ?? '').trim()
    if (texto) window.localStorage.setItem(CLAVE_SOLICITANTE, texto)
  } catch {
    // Sin almacenamiento disponible: el campo simplemente no se pre-llena.
  }
}

// Una solicitud se vincula a líneas de factura O de boleta, nunca a ambas (lo hace
// cumplir la base). Quita las solicitudes ya ocupadas por el OTRO tipo de documento
// (`ocupadasPorOtroTipo`: ids), salvo las que ya tiene este documento (`actuales`: ids),
// que se conservan para poder verlas y mantenerlas.
export function solicitudesDisponibles(solicitudes, ocupadasPorOtroTipo, actuales = []) {
  const ocupadas = new Set(ocupadasPorOtroTipo ?? [])
  const propias = new Set(actuales ?? [])
  return (solicitudes ?? []).filter((s) => !ocupadas.has(s.id) || propias.has(s.id))
}

// Opción del selector de solicitud de una línea: insumo × cantidad, y quién la pidió.
// `idsInsumoOkima`: insumos Okima de la línea, para marcar "mismo insumo" (opcional).
export function opcionSolicitud(s, idsInsumoOkima = []) {
  const detalle = [
    s.solicitante,
    `urgencia ${s.nivel_urgencia}`,
    s.fecha_esperada ? `tope ${formatoFecha(s.fecha_esperada)}` : null,
    s.estado && s.estado !== 'Pendiente' ? s.estado : null,
    idsInsumoOkima.includes(s.id_insumo_okima) ? 'mismo insumo' : null,
  ]
  return {
    valor: s.id,
    etiqueta: `${s.insumo_nombre} × ${formatoNumero(s.cantidad_solicitada)}`,
    detalle: detalle.filter(Boolean).join(' · '),
  }
}
