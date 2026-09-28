// Ordenamiento y paginación de las tablas (lógica pura, sin DOM ni React).
import { normalizar } from './texto'

export const TAMANO_PAGINA = 50

// Valor por el que se ordena una columna: el mismo criterio que usa el CSV, salvo
// que la columna declare `orden(fila)` (ej. para ordenar por un dato que no se muestra).
export function valorOrden(columna, fila) {
  if (columna.orden) return columna.orden(fila)
  if (columna.csv) return columna.csv(fila)
  return fila[columna.clave]
}

// Vacíos (y objetos, que no tienen un orden natural) van siempre al final.
function esVacio(v) {
  if (v === null || v === undefined || typeof v === 'object') return true
  if (typeof v === 'number') return Number.isNaN(v)
  return typeof v === 'string' && v.trim() === ''
}

// Una columna ofrece orden solo si alguna fila tiene un valor ordenable; así las
// columnas de controles o de objetos anidados sin `csv`/`orden` no muestran el botón.
export function esOrdenable(columna, filas) {
  return filas.some((fila) => !esVacio(valorOrden(columna, fila)))
}

function comparar(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return normalizar(a).localeCompare(normalizar(b), 'es', { numeric: true })
}

// Devuelve una copia ordenada; con `direccion` distinta de 'asc'/'desc' o sin columna
// devuelve `filas` tal cual (orden original). Estable: los empates conservan su orden.
export function ordenarFilas(filas, columna, direccion) {
  if (!columna || (direccion !== 'asc' && direccion !== 'desc')) return filas
  const signo = direccion === 'desc' ? -1 : 1
  return filas
    .map((fila, indice) => ({ fila, indice, valor: valorOrden(columna, fila) }))
    .sort((x, y) => {
      const vx = esVacio(x.valor)
      const vy = esVacio(y.valor)
      if (vx || vy) return vx === vy ? x.indice - y.indice : vx ? 1 : -1
      return signo * comparar(x.valor, y.valor) || x.indice - y.indice
    })
    .map((e) => e.fila)
}

// Ventana de la página actual, con la página acotada a [1, totalPaginas].
// `inicio` es 0-based y `fin` exclusivo, listos para un slice.
export function paginar(total, pagina, tamano = TAMANO_PAGINA) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))
  const actual = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalPaginas)
  const inicio = (actual - 1) * tamano
  return { pagina: actual, totalPaginas, inicio, fin: Math.min(inicio + tamano, total) }
}
