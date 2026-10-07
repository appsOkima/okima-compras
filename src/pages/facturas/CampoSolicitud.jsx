import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { claseBotonSecundario } from '../../components/estilos'
import { opcionSolicitud } from '../../lib/solicitudes'
import Campo from './Campo'
import ModalSolicitudes from './ModalSolicitudes'

// Campo opcional "Solicitud de compra" de una línea de factura o de boleta: un botón
// que abre el modal de solicitudes (ModalSolicitudes) o, si ya hay una, su resumen con
// "Cambiar" y "Quitar". `solicitudes`, `excluir` e `idsInsumoOkima` se explican en el modal.
function CampoSolicitud({ id, solicitudes, excluir, idsInsumoOkima, valor, onChange, cargando }) {
  const [abierto, setAbierto] = useState(false)
  const elegida = valor ? solicitudes.find((s) => s.id === valor) : null
  const resumen = elegida ? opcionSolicitud(elegida, idsInsumoOkima) : null

  const elegir = (idSolicitud) => {
    setAbierto(false)
    onChange(idSolicitud)
  }

  return (
    <Campo id={id} etiqueta="Solicitud de compra" ayuda="Opcional: al guardar, la solicitud pasa a 'Comprada'.">
      {valor ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5">
          <p className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-medium text-slate-800">
              {resumen ? resumen.etiqueta : 'Solicitud vinculada'}
            </span>
            {resumen?.detalle && <span className="block truncate text-xs text-slate-500">{resumen.detalle}</span>}
          </p>
          <button
            id={id}
            type="button"
            onClick={() => setAbierto(true)}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Quitar solicitud"
            title="Quitar solicitud"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button id={id} type="button" onClick={() => setAbierto(true)} disabled={cargando} className={claseBotonSecundario}>
          <Link2 className="h-4 w-4" />
          {cargando ? 'Cargando solicitudes…' : 'Vincular solicitud'}
        </button>
      )}

      {abierto && (
        <ModalSolicitudes
          solicitudes={solicitudes}
          excluir={excluir}
          idsInsumoOkima={idsInsumoOkima}
          valorActual={valor}
          onElegir={elegir}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </Campo>
  )
}

export default CampoSolicitud
