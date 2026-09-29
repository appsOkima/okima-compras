import { useLayoutEffect, useRef } from 'react'
import { editarRut } from '../lib/rut'

// Input de RUT controlado que se formatea al escribir (12.345.678-9): solo acepta
// dígitos y K (el resto de las teclas no hace nada) y mantiene el cursor tras los
// mismos dígitos aunque se agreguen o muevan puntos. Pegar un RUT con o sin
// formato también funciona. `onChange` recibe el texto ya formateado; no valida
// el dígito verificador (eso lo hace quien lo usa, ver validarRut).
// El resto de las props (id, className, aria-*, onBlur, autoFocus…) pasan al <input>.
function InputRut({ valor = '', onChange, ...props }) {
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
    const nuevo = editarRut(valor, el.value, el.selectionStart ?? el.value.length, haciaAdelante)
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
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      value={valor}
      onChange={cambiar}
    />
  )
}

export default InputRut
