// Cursor estable en inputs que se formatean al escribir (RUT, números): sin
// React, para poder verificarlo con node. Cada formato define qué caracteres son
// "significativos" (los que escribe el usuario, ej. dígitos) y cuáles son solo
// separadores que pone el formato (ej. puntos de miles).

// Posición en el texto formateado justo después de `cantidad` caracteres
// significativos (0 → al inicio).
export function posicionTras(formateado, cantidad, esSignificativo) {
  if (cantidad <= 0) return 0
  let vistos = 0
  for (let i = 0; i < formateado.length; i++) {
    if (esSignificativo(formateado[i])) vistos++
    if (vistos === cantidad) return i + 1
  }
  return formateado.length
}

// Aplica un cambio del input: `anterior` es el valor formateado que mostraba,
// `crudo` lo que quedó tras la tecla y `cursor` dónde quedó el cursor en `crudo`.
// Devuelve el nuevo valor formateado y dónde dejar el cursor (tras los mismos
// caracteres significativos que tenía antes). Si se borró solo un separador, se
// borra el carácter significativo de al lado (el anterior con Retroceso, el
// siguiente con Suprimir, `haciaAdelante`): si no, el formato lo repondría y no se
// podría borrar.
// `formato`: { limpiar(texto) → significativos, formatear(limpio) → texto,
// significativosAntes(crudo, cursor) → cantidad, esSignificativo(caracter) }.
export function editarConFormato(anterior, crudo, cursor, haciaAdelante, formato) {
  const { limpiar, formatear, significativosAntes, esSignificativo } = formato
  let limpio = limpiar(crudo)
  let antes = significativosAntes(crudo, cursor)
  const borroSeparador = crudo.length === anterior.length - 1 && limpio !== '' && limpio === limpiar(anterior)
  if (borroSeparador && !haciaAdelante && antes > 0) {
    limpio = limpio.slice(0, antes - 1) + limpio.slice(antes)
    antes--
  } else if (borroSeparador && haciaAdelante && antes < limpio.length) {
    limpio = limpio.slice(0, antes) + limpio.slice(antes + 1)
  }
  const valor = formatear(limpio)
  // Borrar un carácter puede dejar ceros iniciales, que se van: el cursor no pasa del final.
  const cantidad = Math.min(antes, limpiar(valor).length)
  return { valor, cursor: posicionTras(valor, cantidad, esSignificativo) }
}
