import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import FiltroMes from '../../components/FiltroMes'
import TablaDatos from '../../components/TablaDatos'
import { claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { formatoCLP, formatoCompra, formatoFecha, formatoNumero } from '../../lib/formato'
import { mesDe, mesesPresentes } from '../../lib/gastos'
import { coincide } from '../../lib/texto'

// Solo lo que muestra la tabla o exporta el CSV. !id_insumo_stock y
// !id_solicitud_compra nombran la FK para que el embebido no sea ambiguo.
const SELECT =
  'id, id_factura, created_at, cantidad, precio_neto, descuento, subtotal, qty_stock, id_solicitud_compra, ' +
  'factura:facturas(numero_factura, fecha, proveedor:proveedores(nombre, rut)), ' +
  'insumo_proveedor:insumos_proveedores(nombre, codigo, cantidad_formato, formato_unidad), ' +
  'insumo_stock:insumos!id_insumo_stock(nombre), ' +
  'solicitud:solicitudes_compra!id_solicitud_compra(solicitante, insumo:insumos(nombre))'

const ORDEN_CONSULTA = { columna: 'created_at', ascendente: false }

const fechaFactura = (l) => l.factura?.fecha ?? null
const numeroFactura = (l) => l.factura?.numero_factura ?? ''
const nombreProveedor = (l) => l.factura?.proveedor?.nombre ?? ''
const nombreInsumoProveedor = (l) => l.insumo_proveedor?.nombre ?? ''
const nombreInsumoStock = (l) => l.insumo_stock?.nombre ?? ''
const monto = (clave) => (l) => <span className="whitespace-nowrap">{formatoCLP(l[clave])}</span>

// Por fecha de la factura (más reciente primero) y, dentro de ella, por ingreso.
// Se ordena aquí: la API ordena por columnas propias, no por las de la factura.
function compararLineas(a, b) {
  const fa = fechaFactura(a) ?? ''
  const fb = fechaFactura(b) ?? ''
  if (fa !== fb) return fa < fb ? 1 : -1
  return String(b.created_at).localeCompare(String(a.created_at))
}

const columnas = [
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (l) => <span className="whitespace-nowrap">{formatoFecha(fechaFactura(l))}</span>,
    csv: fechaFactura,
  },
  { clave: 'numero_factura', titulo: 'N° factura', render: numeroFactura, csv: numeroFactura },
  { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
  { clave: 'rut_proveedor', titulo: 'RUT proveedor', soloCsv: true, csv: (l) => l.factura?.proveedor?.rut ?? '' },
  {
    clave: 'insumo_proveedor',
    titulo: 'Insumo del proveedor',
    csv: nombreInsumoProveedor,
    render: (l) => (
      <>
        {nombreInsumoProveedor(l)}
        {l.insumo_proveedor?.codigo && <span className="block text-xs text-slate-500">{l.insumo_proveedor.codigo}</span>}
      </>
    ),
  },
  { clave: 'codigo', titulo: 'Código proveedor', soloCsv: true, csv: (l) => l.insumo_proveedor?.codigo ?? '' },
  {
    clave: 'formato',
    titulo: 'Formato',
    soloTabla: true,
    render: (l) => formatoCompra(l.insumo_proveedor?.cantidad_formato, l.insumo_proveedor?.formato_unidad),
  },
  { clave: 'formato_unidad', titulo: 'Formato unidad', soloCsv: true, csv: (l) => l.insumo_proveedor?.formato_unidad ?? '' },
  {
    clave: 'cantidad_formato',
    titulo: 'Cantidad por formato',
    soloCsv: true,
    csv: (l) => l.insumo_proveedor?.cantidad_formato ?? null,
  },
  {
    clave: 'insumo_stock',
    titulo: 'Insumo Okima',
    csv: nombreInsumoStock,
    render: (l) => nombreInsumoStock(l) || <span className="text-xs text-slate-400">Sin stock</span>,
  },
  { clave: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', render: (l) => formatoNumero(l.cantidad) },
  { clave: 'precio_neto', titulo: 'Precio neto', alinear: 'derecha', render: monto('precio_neto') },
  { clave: 'descuento', titulo: 'Descuento', alinear: 'derecha', render: monto('descuento') },
  { clave: 'subtotal', titulo: 'Subtotal', alinear: 'derecha', render: monto('subtotal') },
  { clave: 'qty_stock', titulo: 'Stock sumado', alinear: 'derecha', render: (l) => formatoNumero(l.qty_stock) },
  {
    clave: 'solicitud',
    titulo: 'Solicitud',
    soloCsv: true,
    csv: (l) => (l.solicitud ? `${l.solicitud.insumo?.nombre ?? ''} (${l.solicitud.solicitante})` : ''),
  },
  { clave: 'id_solicitud_compra', titulo: 'ID solicitud', soloCsv: true },
  { clave: 'id_factura', titulo: 'ID factura', soloCsv: true },
  { clave: 'id', titulo: 'ID línea', soloCsv: true },
]

// Todas las líneas de factura, de solo lectura: es la exportación pensada para el
// ERP (el CSV lleva además RUT, formato, solicitud e ids).
function Lineas() {
  const { filas, cargando, error } = useTabla('detalle_facturas', { select: SELECT, orden: ORDEN_CONSULTA })
  const [busqueda, setBusqueda] = useState('')
  const [mes, setMes] = useState('')

  const meses = useMemo(() => mesesPresentes(filas.map((l) => ({ fecha: fechaFactura(l) }))), [filas])

  const visibles = useMemo(
    () =>
      filas
        .filter(
          (l) =>
            (!mes || mesDe(fechaFactura(l)) === mes) &&
            (!busqueda ||
              [numeroFactura(l), nombreProveedor(l), nombreInsumoProveedor(l), l.insumo_proveedor?.codigo, nombreInsumoStock(l)].some(
                (v) => coincide(v, busqueda),
              )),
        )
        .sort(compararLineas),
    [filas, mes, busqueda],
  )

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar factura, proveedor o insumo…"
          aria-label="Buscar líneas de factura"
          className={`${claseInput} pl-9`}
        />
      </div>
      <FiltroMes meses={meses} valor={mes} onChange={setMes} />
    </>
  )

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Líneas de factura</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todas las líneas, con su insumo Okima y el stock que sumaron. Solo lectura: para corregir una línea, edita su
          factura.
        </p>
      </div>

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="lineas-facturas"
          cargando={cargando}
          error={error}
          vacio={busqueda || mes ? 'Ninguna línea coincide con los filtros.' : 'Todavía no hay líneas de factura.'}
          barra={barra}
        />
      </div>
    </section>
  )
}

export default Lineas
