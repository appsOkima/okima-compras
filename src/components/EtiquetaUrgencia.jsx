import { metaUrgencia } from '../lib/solicitudes'

// Pastilla de nivel de urgencia: color en pantalla, y siempre símbolo + texto en
// negrita para que se distinga al imprimir en escala de grises.
function EtiquetaUrgencia({ nivel }) {
  const { etiqueta, simbolo, claseEtiqueta } = metaUrgencia(nivel)
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset print:rounded-none print:bg-transparent print:px-0 print:text-sm print:font-bold print:text-black print:ring-0 ${claseEtiqueta}`}
    >
      <span aria-hidden="true">{simbolo}</span>
      {etiqueta}
    </span>
  )
}

export default EtiquetaUrgencia
