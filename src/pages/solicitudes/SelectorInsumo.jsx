import ComboboxInsumoOkima from '../../components/ComboboxInsumoOkima'

// Selector de insumo Okima de Solicitudes: el patrón de creación al vuelo vive en
// el componente compartido (también lo usan los vínculos del catálogo).
function SelectorInsumo(props) {
  return <ComboboxInsumoOkima {...props} />
}

export default SelectorInsumo
