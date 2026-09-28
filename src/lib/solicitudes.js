// Reglas de presentación de las solicitudes de compra (sin React ni Supabase,
// para poder verificarlas con node). La extensión .js explícita es para node.
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

export function claseEstado(estado) {
  return CLASES_ESTADO[estado] ?? CLASES_ESTADO.Cancelada
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
