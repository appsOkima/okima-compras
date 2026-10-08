import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import EtiquetaUrgencia from '../../components/EtiquetaUrgencia'
import Modal from '../../components/Modal'
import { claseInput } from '../../components/estilos'
import { formatoFecha, formatoNumero } from '../../lib/formato'
import { solicitudesParaModal } from '../../lib/vinculacion'

// Modal de vinculación de una línea (factura o boleta) con una solicitud de compra
// (Sprint2 §3.2). `solicitudes` ya excluye las ocupadas por el otro tipo de documento;
// `excluir` son los ids elegidos en otras líneas del mismo documento e `idsInsumoOkima`
// los insumos Okima del insumo del proveedor de la línea: las solicitudes de esos
// insumos van primero y se marcan. `valorActual` es la solicitud hoy vinculada.
function ModalSolicitudes({ solicitudes, excluir, idsInsumoOkima, valorActual, onElegir, onCerrar }) {
  const [busqueda, setBusqueda] = useState('')
  const filas = useMemo(
    () => solicitudesParaModal(solicitudes, { idsInsumoOkima, excluir, busqueda }),
    [solicitudes, idsInsumoOkima, excluir, busqueda],
  )

  return (
    <Modal titulo="Vincular solicitud de compra" onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por insumo o solicitante…"
          aria-label="Buscar solicitud"
          className={`${claseInput} pl-9`}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {idsInsumoOkima.length > 0
          ? 'Primero las solicitudes del mismo insumo Okima que el de la línea; luego por urgencia y fecha tope.'
          : 'Ordenadas por urgencia y fecha tope (elige antes el insumo de la línea para priorizar las del mismo insumo).'}
      </p>

      {filas.length === 0 ? (
        <p className="mt-4 rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {busqueda ? 'Ninguna solicitud coincide con la búsqueda.' : 'No hay solicitudes disponibles para vincular.'}
        </p>
      ) : (
        <ul className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {filas.map(({ solicitud: s, coincide }) => {
            const actual = s.id === valorActual
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onElegir(s.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border p-3 text-left text-sm hover:bg-primary-50/60 ${
                    actual ? 'border-primary-light bg-primary-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">
                      {s.insumo_nombre} × {formatoNumero(s.cantidad_solicitada)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {s.solicitante}
                      {' · tope '}
                      {formatoFecha(s.fecha_esperada)}
                    </span>
                    {coincide && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                        <Check className="h-3 w-3" />
                        Coincide con el insumo
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {actual && <span className="text-xs font-medium text-primary-darker">Vinculada</span>}
                    <EtiquetaUrgencia nivel={s.nivel_urgencia} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

export default ModalSolicitudes
