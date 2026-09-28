// Comparación de textos para búsquedas y detección de duplicados.
// El chequeo de duplicados es de aplicación (no hay UNIQUE en la base), así que
// debe tolerar mayúsculas, tildes, espacios extra y typos pequeños.

// Minúsculas, sin tildes, sin espacios al borde y con espacios internos colapsados.
export function normalizar(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Para cajas de búsqueda: el filtro vacío deja pasar todo.
export function coincide(texto, filtro) {
  const f = normalizar(filtro)
  if (!f) return true
  return normalizar(texto).includes(f)
}

// Distancia de edición clásica (inserción, borrado, sustitución).
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo)
    }
    previa = actual
  }
  return previa[b.length]
}

// Registros cuyo campo es igual o "muy parecido" al texto. El umbral de largo (4)
// evita que nombres muy cortos (ej. "A3", "PVC") coincidan con casi todo. Es solo
// un aviso: un falso positivo (ej. "tinta" vs "cinta") se confirma con un clic.
export function buscarSimilares(texto, registros, campo = 'nombre') {
  const t = normalizar(texto)
  if (!t || !registros) return []
  const exactos = []
  const parecidos = []
  for (const registro of registros) {
    const r = normalizar(registro?.[campo])
    if (!r) continue
    if (r === t) {
      exactos.push(registro)
      continue
    }
    const corto = Math.min(r.length, t.length)
    const cercano = corto >= 4 && levenshtein(r, t) <= 2
    const contenido = corto >= 4 && (r.includes(t) || t.includes(r))
    if (cercano || contenido) parecidos.push(registro)
  }
  return [...exactos, ...parecidos]
}

// RUT comparable: sin puntos, guiones ni espacios y con la K en mayúscula
// ("76.123.456-k" → "76123456K"). No valida el dígito verificador.
export function normalizarRut(rut) {
  if (rut === null || rut === undefined) return ''
  return String(rut).replace(/[.\-\s]/g, '').toUpperCase()
}

// Vacío para los filtros "Incompletos": null, undefined o texto en blanco.
export function estaVacio(valor) {
  return valor === null || valor === undefined || String(valor).trim() === ''
}
