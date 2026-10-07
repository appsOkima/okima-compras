import { useId } from 'react'
import { Trash2 } from 'lucide-react'
import InputNumero from '../../components/InputNumero'
import { claseInput } from '../../components/estilos'
import { subtotalDeBoleta } from '../../lib/boletas'
import { formatoCLP } from '../../lib/formato'
import Campo from '../facturas/Campo'
import CampoSolicitud from '../facturas/CampoSolicitud'
import SelectorInsumoProveedor from '../facturas/SelectorInsumoProveedor'

const claseError = ' border-red-400 focus:border-red-500 focus:ring-red-500/30'

// Una línea de la boleta: descripción, insumo del proveedor opcional (con creación
// al vuelo si la boleta tiene proveedor), solicitud de compra opcional (el modal usa
// `solicitudes`, `excluirSolicitudes` e `idsInsumoOkima`), cantidad y precio unitario. El subtotal se
// calcula y solo se muestra. El stock lo mueve la base al guardar si el insumo está
// vinculado a insumos Okima.
function LineaBoleta({
  linea,
  numero,
  errores = {},
  catalogo,
  idProveedor,
  onCrearInsumo,
  cargandoCatalogo,
  solicitudes,
  excluirSolicitudes,
  idsInsumoOkima,
  cargandoSolicitudes,
  onCambiar,
  onQuitar,
  puedeQuitar,
}) {
  const idBase = useId()

  const numerico = (campo, etiqueta) => (
    <Campo id={`${idBase}-${campo}`} etiqueta={etiqueta} requerido error={errores[campo]}>
      <InputNumero
        id={`${idBase}-${campo}`}
        valor={linea[campo]}
        onChange={(valor) => onCambiar(campo, valor)}
        className={`${claseInput}${errores[campo] ? claseError : ''}`}
      />
    </Campo>
  )

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Línea {numero}</span>
        <button
          type="button"
          onClick={onQuitar}
          disabled={!puedeQuitar}
          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          aria-label={`Quitar línea ${numero}`}
          title={puedeQuitar ? 'Quitar línea' : 'La boleta necesita al menos una línea'}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Campo id={`${idBase}-descripcion`} etiqueta="Descripción" requerido error={errores.descripcion}>
          <input
            id={`${idBase}-descripcion`}
            type="text"
            value={linea.descripcion}
            onChange={(e) => onCambiar('descripcion', e.target.value)}
            className={`${claseInput}${errores.descripcion ? claseError : ''}`}
          />
        </Campo>
        <Campo
          id={`${idBase}-insumo`}
          etiqueta="Insumo del proveedor"
          ayuda="Opcional. Si está vinculado a insumos Okima, la línea suma stock al guardar."
        >
          <SelectorInsumoProveedor
            id={`${idBase}-insumo`}
            valor={linea.id_insumo_proveedor}
            onChange={(v) => onCambiar('id_insumo_proveedor', v)}
            catalogo={catalogo}
            idProveedor={idProveedor}
            onCrearInsumo={onCrearInsumo}
            cargando={cargandoCatalogo}
            proveedorOpcional
          />
        </Campo>
        <CampoSolicitud
          id={`${idBase}-solicitud`}
          solicitudes={solicitudes}
          excluir={excluirSolicitudes}
          idsInsumoOkima={idsInsumoOkima}
          valor={linea.id_solicitud_compra}
          onChange={(v) => onCambiar('id_solicitud_compra', v)}
          cargando={cargandoSolicitudes}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numerico('cantidad', 'Cantidad')}
        {numerico('precio', 'Precio unitario (CLP)')}
        <div className="col-span-2 sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-slate-700">Subtotal</span>
          <p
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-slate-800"
            title="Cantidad × precio unitario"
            aria-live="polite"
          >
            {formatoCLP(subtotalDeBoleta(linea))}
          </p>
        </div>
      </div>
    </div>
  )
}

export default LineaBoleta
