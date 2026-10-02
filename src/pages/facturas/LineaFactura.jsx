import { useId } from 'react'
import { AlertTriangle, Link2, PackageCheck, PackageX, Trash2, X } from 'lucide-react'
import Combobox from '../../components/Combobox'
import InputNumero from '../../components/InputNumero'
import { claseInput } from '../../components/estilos'
import { efectoStock, subtotalDe } from '../../lib/facturas'
import { formatoCLP, formatoNumero } from '../../lib/formato'
import { AYUDA_FACTOR, validarFactor } from '../../lib/vinculos'
import Campo from './Campo'
import SelectorInsumoProveedor from './SelectorInsumoProveedor'

const claseError = ' border-red-400 focus:border-red-500 focus:ring-red-500/30'

// "+12 Taza, +0,5 Plato": lo que suma (o sumó) una línea al stock.
const listaMovimientos = (movimientos) => movimientos.map((m) => `+${formatoNumero(m.qty)} ${m.nombre}`).join(', ')

// Texto del aviso de stock (ver efectoStock): qué hará el trigger al guardar.
// Cada vínculo del insumo del proveedor suma cantidad × factor a su insumo Okima.
function avisoStock(efecto) {
  if (!efecto) return null
  const revierte =
    efecto.revierte.length > 0 ? ` Se descuentan los ${listaMovimientos(efecto.revierte)} sumados antes.` : ''
  switch (efecto.tipo) {
    case 'aplicado':
      return { suma: true, texto: `Ya sumó al stock: ${listaMovimientos(efecto.movimientos)}.` }
    case 'no-aplicado':
      return {
        suma: false,
        texto:
          'Se guardó sin vínculo a insumo Okima: no sumó stock. Un vínculo nuevo aplica a compras futuras; esta línea ya guardada no suma stock (vincular después no lo aplica).',
      }
    case 'suma': {
      const texto = listaMovimientos(efecto.movimientos)
      const porVincular = efecto.movimientos.some((m) => m.pendiente) ? ' (los vínculos nuevos se aplican al guardar)' : ''
      return { suma: true, texto: `Suma al stock: ${texto}${porVincular}.${revierte}` }
    }
    default:
      return { suma: false, texto: `Sin vínculo a insumo Okima: no suma stock.${revierte}` }
  }
}

const claseEnlace = 'rounded px-1 font-medium underline hover:bg-white/60'

// Pregunta (o decisión tomada) sobre vincular el insumo del proveedor con el
// insumo Okima de la solicitud (ver vinculoPropuesto). La decisión se puede
// cambiar hasta guardar.
function PanelVinculo({ propuesta, onDecidir, onCambiarFactor }) {
  if (!propuesta || propuesta.tipo === 'ninguno') return null
  const aviso = (texto) => (
    <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800" role="alert">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      {texto}
    </p>
  )
  if (propuesta.tipo === 'ya-vinculado') {
    return aviso(
      `Este insumo está vinculado a «${propuesta.nombreVinculado}», pero la solicitud es de «${propuesta.nombreInsumoOkima}». ` +
        'No se agrega un vínculo aquí; si falta, edítalo en el Catálogo de Proveedores.',
    )
  }

  const par = `«${propuesta.nombreInsumoProveedor}» con «${propuesta.nombreInsumoOkima}»`
  const errorFactor = validarFactor(propuesta.factor)
  // Factor de conversión: editable mientras se decide y hasta guardar.
  const campoFactor = (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      Factor ×
      <InputNumero
        className={`${claseInput} w-24 py-1${errorFactor ? claseError : ''}`}
        valor={propuesta.factor}
        onChange={onCambiarFactor}
        aria-label="Factor de conversión del vínculo"
      />
    </label>
  )
  if (propuesta.decision === 'aceptado') {
    return (
      <div className="mt-2 space-y-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-indigo-700">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          Se vinculará {par} al guardar.
          {campoFactor}
          <button type="button" onClick={() => onDecidir(false)} className={claseEnlace}>
            No vincular
          </button>
        </p>
        {errorFactor && <p className="text-xs text-red-600">{errorFactor}</p>}
      </div>
    )
  }
  if (propuesta.decision === 'rechazado') {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        No se vinculará {par}.
        <button type="button" onClick={() => onDecidir(true)} className={claseEnlace}>
          Vincular
        </button>
      </p>
    )
  }
  return (
    <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/60 p-2 text-sm text-slate-700" role="group" aria-label="Vincular insumo">
      <p className="flex items-start gap-1.5">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
        <span>
          ¿Vincular «{propuesta.nombreInsumoProveedor}» con el insumo Okima «{propuesta.nombreInsumoOkima}»? Desde ahora sus
          compras sumarán stock a ese insumo.
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {campoFactor}
        <button
          type="button"
          onClick={() => onDecidir(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          No vincular
        </button>
        <button
          type="button"
          onClick={() => onDecidir(true)}
          className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Vincular
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">{AYUDA_FACTOR}</p>
      {errorFactor && <p className="mt-1 text-xs text-red-600">{errorFactor}</p>}
    </div>
  )
}

// Una línea de la factura: insumo del proveedor (con creación al vuelo), solicitud
// opcional, cantidad, precio, descuento en % y el aviso de stock. El subtotal se
// calcula y solo se muestra. `original` es la línea guardada (null
// si es nueva) y `opcionesSolicitud` ya viene ordenada para esta línea.
// `propuestaVinculo` (ver vinculoPropuesto) y `vinculosPendientes` (vínculos
// aceptados en esta u otra línea para este insumo, que se aplicarán al guardar)
// alimentan el panel de vínculo y el aviso de stock.
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
  propuestaVinculo,
  vinculosPendientes,
  onDecidirVinculo,
  onCambiar,
  onQuitar,
  puedeQuitar,
}) {
  const idBase = useId()
  // Vínculos guardados del insumo más los aceptados que se aplicarán al guardar
  // (estos solo existen si el insumo no tiene ninguno, ver vinculosAAplicar).
  const vinculos = [
    ...(itemCatalogo?.vinculos ?? []).map((v) => ({
      nombre: v.insumo?.nombre ?? 'insumo Okima',
      factor: v.factor_conversion,
    })),
    ...vinculosPendientes.map((v) => ({ nombre: v.nombreInsumoOkima, factor: v.factor, pendiente: true })),
  ]
  const aviso = avisoStock(
    efectoStock({ idInsumoProveedor: linea.id_insumo_proveedor, cantidad: linea.cantidad, vinculos }, original),
  )

  const subtotal = subtotalDe(linea)

  // Punto de miles y coma decimal al escribir (InputNumero). Mínimo 0 y descuento
  // ≤ 100 los revisa erroresLinea al guardar (el input de texto no tiene min/max).
  const numerico = (campo, etiqueta, { requerido = true, ...extra } = {}) => (
    <Campo id={`${idBase}-${campo}`} etiqueta={etiqueta} requerido={requerido} error={errores[campo]}>
      <InputNumero
        id={`${idBase}-${campo}`}
        {...extra}
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
        {numerico('descuento_pct', 'Descuento %', { requerido: false, placeholder: '0' })}
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

      <PanelVinculo
        propuesta={propuestaVinculo}
        onDecidir={onDecidirVinculo}
        onCambiarFactor={(valor) => onCambiar('factorVinculo', valor)}
      />

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
