import { useId } from 'react'
import { PackageCheck, PackageX, Trash2, X } from 'lucide-react'
import Combobox from '../../components/Combobox'
import { claseInput } from '../../components/estilos'
import { efectoStock, subtotalDe } from '../../lib/facturas'
import { formatoCLP, formatoNumero } from '../../lib/formato'
import Campo from './Campo'
import SelectorInsumoProveedor from './SelectorInsumoProveedor'

const claseError = ' border-red-400 focus:border-red-500 focus:ring-red-500/30'

// Texto del aviso de stock (ver efectoStock): qué hará el trigger al guardar.
function avisoStock(efecto, item, original) {
  if (!efecto) return null
  const nombreOriginal = original?.insumo_stock?.nombre ?? 'el insumo Okima'
  const revierte =
    efecto.revierte !== null ? ` Se descuentan de ${nombreOriginal} los ${formatoNumero(efecto.revierte)} sumados antes.` : ''
  switch (efecto.tipo) {
    case 'aplicado':
      return { suma: true, texto: `Ya sumó ${formatoNumero(efecto.qty)} al stock de ${nombreOriginal}.` }
    case 'no-aplicado':
      return {
        suma: false,
        texto: 'Se guardó sin vínculo a insumo Okima: no sumó stock (vincular después no lo aplica).',
      }
    case 'suma': {
      const cantidad = efecto.qty === null ? '' : `${formatoNumero(efecto.qty)} `
      const formato = item?.cantidad_formato ? ` (${formatoNumero(item.cantidad_formato)} por formato)` : ''
      return { suma: true, texto: `Suma ${cantidad}al stock de ${item?.insumo_okima?.nombre ?? 'el insumo Okima'}${formato}.${revierte}` }
    }
    default:
      return { suma: false, texto: `Sin vínculo a insumo Okima: no suma stock.${revierte}` }
  }
}

// Una línea de la factura: insumo del proveedor (con creación al vuelo), solicitud
// opcional, cantidad, precio, descuento en % y el aviso de stock. El subtotal se
// calcula y solo se muestra. `original` es la línea guardada (null
// si es nueva) y `opcionesSolicitud` ya viene ordenada para esta línea.
function LineaFactura({
  linea,
  numero,
  errores = {},
  catalogo,
  itemCatalogo,
  idProveedor,
  onCrearInsumo,
  cargandoCatalogo,
  opcionesSolicitud,
  cargandoSolicitudes,
  original,
  onCambiar,
  onQuitar,
  puedeQuitar,
}) {
  const idBase = useId()
  const aviso = avisoStock(
    efectoStock(
      {
        idInsumoProveedor: linea.id_insumo_proveedor,
        cantidad: linea.cantidad,
        cantidadFormato: itemCatalogo?.cantidad_formato,
        idInsumoOkima: itemCatalogo?.id_insumo_okima,
      },
      original,
    ),
    itemCatalogo,
    original,
  )

  const subtotal = subtotalDe(linea)

  const numerico = (campo, etiqueta, { requerido = true, ...extra } = {}) => (
    <Campo id={`${idBase}-${campo}`} etiqueta={etiqueta} requerido={requerido} error={errores[campo]}>
      <input
        id={`${idBase}-${campo}`}
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        {...extra}
        value={linea[campo]}
        onChange={(e) => onCambiar(campo, e.target.value)}
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
          title={puedeQuitar ? 'Quitar línea' : 'La factura necesita al menos una línea'}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Campo
          id={`${idBase}-insumo`}
          etiqueta="Insumo del proveedor"
          requerido
          error={errores.id_insumo_proveedor}
        >
          <SelectorInsumoProveedor
            id={`${idBase}-insumo`}
            valor={linea.id_insumo_proveedor}
            onChange={(v) => onCambiar('id_insumo_proveedor', v)}
            catalogo={catalogo}
            idProveedor={idProveedor}
            onCrearInsumo={onCrearInsumo}
            cargando={cargandoCatalogo}
          />
        </Campo>
        <Campo id={`${idBase}-solicitud`} etiqueta="Solicitud de compra" ayuda="Opcional: al guardar, la solicitud pasa a 'Comprada'.">
          <div className="flex items-center gap-2">
            <Combobox
              id={`${idBase}-solicitud`}
              className="flex-1"
              opciones={opcionesSolicitud}
              valor={linea.id_solicitud_compra}
              onChange={(v) => onCambiar('id_solicitud_compra', v)}
              placeholder={cargandoSolicitudes ? 'Cargando solicitudes…' : 'Sin solicitud (opcional)…'}
              disabled={cargandoSolicitudes}
            />
            {linea.id_solicitud_compra && (
              <button
                type="button"
                onClick={() => onCambiar('id_solicitud_compra', '')}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Quitar solicitud"
                title="Quitar solicitud"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </Campo>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numerico('cantidad', 'Cantidad')}
        {numerico('precio_neto', 'Precio neto')}
        {numerico('descuento_pct', 'Descuento %', { requerido: false, max: '100', placeholder: '0' })}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Subtotal</span>
          <p
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-slate-800"
            title="Cantidad × precio neto − descuento %"
            aria-live="polite"
          >
            {formatoCLP(subtotal)}
          </p>
        </div>
      </div>

      {aviso && (
        <p className={`mt-2 flex items-start gap-1.5 text-xs ${aviso.suma ? 'text-emerald-700' : 'text-slate-500'}`}>
          {aviso.suma ? (
            <PackageCheck className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <PackageX className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          {aviso.texto}
        </p>
      )}
    </div>
  )
}

export default LineaFactura
