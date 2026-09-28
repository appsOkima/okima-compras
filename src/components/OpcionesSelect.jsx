// Renderiza las <option> de un <select>; las que traen `grupo` van en <optgroup>,
// en el orden en que aparece cada grupo (quien arma la lista decide el orden).
function OpcionesSelect({ opciones }) {
  const bloques = []
  const porGrupo = new Map()
  for (const opcion of opciones) {
    if (!opcion.grupo) {
      bloques.push({ opcion })
      continue
    }
    let bloque = porGrupo.get(opcion.grupo)
    if (!bloque) {
      bloque = { grupo: opcion.grupo, opciones: [] }
      porGrupo.set(opcion.grupo, bloque)
      bloques.push(bloque)
    }
    bloque.opciones.push(opcion)
  }

  return bloques.map((bloque) =>
    bloque.grupo ? (
      <optgroup key={`g:${bloque.grupo}`} label={bloque.grupo}>
        {bloque.opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </optgroup>
    ) : (
      <option key={bloque.opcion.valor} value={bloque.opcion.valor}>
        {bloque.opcion.etiqueta}
      </option>
    ),
  )
}

export default OpcionesSelect
