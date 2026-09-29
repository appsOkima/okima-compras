import { editarRut } from '../lib/rut'
import InputFormateado from './InputFormateado'

// Input de RUT controlado que se formatea al escribir (12.345.678-9): solo acepta
// dígitos y K (el resto de las teclas no hace nada) y mantiene el cursor tras los
// mismos dígitos aunque se agreguen o muevan puntos. Pegar un RUT con o sin
// formato también funciona. `onChange` recibe el texto ya formateado; no valida
// el dígito verificador (eso lo hace quien lo usa, ver validarRut).
// El resto de las props (id, className, aria-*, onBlur, autoFocus…) pasan al <input>.
function InputRut({ valor = '', onChange, ...props }) {
  return <InputFormateado {...props} inputMode="text" valor={valor} onChange={onChange} editar={editarRut} />
}

export default InputRut
