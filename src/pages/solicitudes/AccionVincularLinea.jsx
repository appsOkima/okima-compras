import { useState } from 'react'
import { Link2 } from 'lucide-react'
import ModalLineas from './ModalLineas'

// Botón de fila "Vincular a una línea" de una solicitud suelta, con su modal de líneas.
// `onVinculado` recarga la lista; el modal se cierra al terminar.
function AccionVincularLinea({ solicitud, nombre, onVinculado }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
        aria-label={`Vincular a una línea: ${nombre}`}
        title="Vincular a una línea de factura o de boleta"
      >
        <Link2 className="h-4 w-4" />
      </button>
      {abierto && (
        <ModalLineas
          solicitud={solicitud}
          onVinculado={async () => {
            setAbierto(false)
            await onVinculado()
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

export default AccionVincularLinea
