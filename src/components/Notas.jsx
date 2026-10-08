import { StickyNote } from 'lucide-react'
import { tieneNotas } from '../lib/notas'

// Aviso destacado con las `notas` de un registro. Sin contenido no renderiza
// nada (no ocupa espacio). `compacto` es la versión para filas de tabla y líneas.
// Colores ámbar, como los demás avisos, para que se note entre los datos normales.
function Notas({ valor, compacto = false, titulo = 'Nota' }) {
  if (!tieneNotas(valor)) return null
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 ${
        compacto ? 'px-2 py-1 text-xs' : 'p-3 text-sm'
      }`}
    >
      <StickyNote className={`shrink-0 ${compacto ? 'mt-px h-3.5 w-3.5' : 'mt-0.5 h-4 w-4'}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words">
        <span className="font-semibold">{titulo}: </span>
        {valor.trim()}
      </p>
    </div>
  )
}

export default Notas
