import { editarNumero } from '../lib/numero'
import InputFormateado from './InputFormateado'

// Input numérico controlado que se formatea al escribir con punto de miles
// (1.234.567) y coma decimal (1.234,5): solo acepta dígitos y, con `decimales`
// (por defecto), una coma; el punto tecleado se ignora porque es solo separador
// de miles. Mantiene el cursor tras los mismos dígitos aunque se muevan los
// puntos. `valor` es el texto formateado (ver numeroAEditable para cargarlo desde
// la base) y `onChange` recibe el texto ya formateado; para guardarlo, ver
// aNumeroDesdeTexto. Sin negativos.
// El resto de las props (id, className, placeholder, aria-*, onBlur…) pasan al <input>.
function InputNumero({ valor = '', onChange, decimales = true, ...props }) {
  const editar = (anterior, crudo, cursor, haciaAdelante) =>
    editarNumero(anterior, crudo, cursor, haciaAdelante, { decimales })
  return (
    <InputFormateado
      {...props}
      inputMode={decimales ? 'decimal' : 'numeric'}
      valor={valor}
      onChange={onChange}
      editar={editar}
    />
  )
}

export default InputNumero
