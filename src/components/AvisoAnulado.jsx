import { Ban } from 'lucide-react'
import { textoAnulacion } from '../lib/anulacion'

// Aviso de un documento anulado: quién, cuándo y por qué, y que no se edita.
// `tipo` es 'factura' o 'boleta' (ambas femeninas).
function AvisoAnulado({ doc, tipo }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="status">
      <Ban className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-medium">{textoAnulacion(doc)}</span> Esta {tipo} no cuenta en totales ni en el Resumen y no
        se puede editar; un administrador debe reactivarla antes.
      </p>
    </div>
  )
}

export default AvisoAnulado
