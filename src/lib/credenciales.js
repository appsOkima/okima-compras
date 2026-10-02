const DOMINIO = 'okima.cl'
const MIN_CLAVE = 8

// El login acepta solo el nombre ("tac") o el email completo.
export function emailDeLogin(texto) {
  const valor = texto.trim().toLowerCase()
  if (!valor) return ''
  return valor.includes('@') ? valor : `${valor}@${DOMINIO}`
}

// null si la clave nueva es válida; si no, el mensaje para mostrar.
export function errorNuevaClave(clave, confirmacion) {
  if (clave.length < MIN_CLAVE) return `La clave debe tener al menos ${MIN_CLAVE} caracteres.`
  if (clave !== confirmacion) return 'Las claves no coinciden.'
  return null
}
