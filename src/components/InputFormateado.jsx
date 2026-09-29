import { useLayoutEffect, useRef } from 'react'

// Input de texto controlado que se formatea al escribir (base de InputRut e
// InputNumero). `editar(anterior, crudo, cursor, haciaAdelante)` devuelve
// { valor, cursor } (ver editarConFormato en lib/cursor): el valor ya formateado
// y dónde dejar el cursor para que quede tras los mismos caracteres aunque se
// agreguen o muevan separadores. `onChange` recibe el texto ya formateado.
// El resto de las props (id, className, inputMode, aria-*, onBlur…) pasan al <input>.
function InputFormateado({ valor = '', onChange, editar, ...props }) {
  const input = useRef(null)
  // Dónde dejar el cursor después de que React dibuje el valor formateado.
  const cursor = useRef(null)

  useLayoutEffect(() => {
    const el = input.current
    if (cursor.current === null || !el) return
    if (document.activeElement === el) el.setSelectionRange(cursor.current, cursor.current)
    cursor.current = null
  }, [valor])

  const cambiar = (e) => {
    const el = e.target
    const haciaAdelante = e.nativeEvent?.inputType === 'deleteContentForward'
    const nuevo = editar(valor, el.value, el.selectionStart ?? el.value.length, haciaAdelante)
    if (nuevo.valor === valor) {
      // Sin cambio real (ej. una letra): React no vuelve a dibujar, así que se
      // repone el texto y el cursor aquí mismo.
      el.value = nuevo.valor
      el.setSelectionRange(nuevo.cursor, nuevo.cursor)
      return
    }
    cursor.current = nuevo.cursor
    onChange(nuevo.valor)
  }

  return (
    <input
      {...props}
      ref={input}
      type="text"
      autoComplete="off"
      spellCheck={false}
      value={valor}
      onChange={cambiar}
    />
  )
}

export default InputFormateado
