// Campo `notas` universal: texto libre con indicaciones de interacción. Vacío no
// se guarda ni se muestra.

// Texto del formulario → valor para la base: recortado, y vacío queda null.
export function normalizarNotas(texto) {
  const limpio = String(texto ?? '').trim()
  return limpio === '' ? null : limpio
}

// ¿Hay algo que mostrar? Falso para null, undefined o solo espacios.
export function tieneNotas(valor) {
  return normalizarNotas(valor) !== null
}

// Campo de formulario estándar para FormularioRegistro: un área de texto que se
// guarda recortada y, vacía, como null (ver el caso 'area' de aGuardable).
export const campoNotas = {
  clave: 'notas',
  etiqueta: 'Notas',
  tipo: 'area',
  ayuda: 'Indicaciones para quien interactúe con este registro. Si hay algo escrito, se destaca en listados y fichas.',
}
