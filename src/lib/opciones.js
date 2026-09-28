// Filtrado de opciones del Combobox, aparte del componente para verificarlo con node.
import { buscarSimilares, coincide, normalizar } from './texto.js'

// opciones = [{ valor, etiqueta, detalle? }]. Devuelve las opciones a dibujar
// (hasta `maximo`), cuántas quedaron fuera y, si `conCrear`, la propuesta de
// creación al vuelo: { texto, conSimilares } o null.
// Solo se propone crear cuando ninguna etiqueta es igual al texto (sin mayúsculas,
// tildes ni espacios extra). Las parecidas (typos, texto contenido) van primero,
// para que se elija una existente antes que crear un duplicado.
export function filtrarOpciones(opciones, texto, { conCrear = false, maximo = Infinity } = {}) {
  const lista = opciones ?? []
  const coincidentes = lista.filter((o) => coincide(`${o.etiqueta} ${o.detalle ?? ''}`, texto ?? ''))
  const buscado = normalizar(texto)

  let ordenadas = coincidentes
  let crear = null
  if (conCrear && buscado && !lista.some((o) => normalizar(o.etiqueta) === buscado)) {
    const similares = buscarSimilares(texto, lista, 'etiqueta')
    const yaIncluidas = new Set(similares.map((o) => o.valor))
    ordenadas = [...similares, ...coincidentes.filter((o) => !yaIncluidas.has(o.valor))]
    crear = { texto: String(texto).trim().replace(/\s+/g, ' '), conSimilares: similares.length > 0 }
  }

  const visibles = ordenadas.slice(0, maximo)
  return { visibles, restantes: ordenadas.length - visibles.length, crear }
}
