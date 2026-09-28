import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import FiltroMes from '../../components/FiltroMes'
import Modal from '../../components/Modal'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonPrimario, claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha, formatoNumero } from '../../lib/formato'
import { mesDe, mesesPresentes } from '../../lib/gastos'
import { coincide, normalizarRut } from '../../lib/texto'
import DetalleFactura from './DetalleFactura'

// De las líneas basta la cantidad (el detalle las consulta al abrirse).
const SELECT = '*, proveedor:proveedores(id, nombre, rut), lineas:detalle_facturas(count)'

// Más reciente primero; a igual fecha, la última ingresada arriba.
const ORDEN = { columna: 'fecha', ascendente: false, luego: { columna: 'created_at', ascendente: false } }

const nombreProveedor = (f) => f.proveedor?.nombre ?? ''
const numeroLineas = (f) => f.lineas?.[0]?.count ?? 0
const monto = (clave) => (f) => <span className="whitespace-nowrap">{formatoCLP(f[clave])}</span>

const columnas = [
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (f) => <span className="whitespace-nowrap">{formatoFecha(f.fecha)}</span>,
  },
  { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
  { clave: 'rut', titulo: 'RUT proveedor', soloCsv: true, csv: (f) => f.proveedor?.rut ?? '' },
  { clave: 'numero_factura', titulo: 'N° factura' },
  { clave: 'neto_total', titulo: 'Neto', alinear: 'derecha', render: monto('neto_total') },
  {
    clave: 'descuento_pct',
    titulo: 'Descuento %',
    alinear: 'derecha',
    render: (f) => (Number(f.descuento_pct) ? `${formatoNumero(f.descuento_pct)} %` : ''),
  },
  { clave: 'iva', titulo: 'IVA', alinear: 'derecha', render: monto('iva') },
  { clave: 'total', titulo: 'Total', alinear: 'derecha', render: monto('total') },
  { clave: 'n_lineas', titulo: 'Líneas', alinear: 'derecha', render: numeroLineas, csv: numeroLineas },
]

// Listado de facturas (totales ya calculados al guardar). Crear y editar abren el
// formulario maestro-detalle en su propia página (/facturas/nueva, /facturas/:id).
function Facturas() {
  const navigate = useNavigate()
  const location = useLocation()
  const { filas, cargando, error, eliminar } = useTabla('facturas', { select: SELECT, orden: ORDEN })
  const [busqueda, setBusqueda] = useState('')
  // '' = todos los meses; si no, 'YYYY-MM'.
  const [mes, setMes] = useState('')
  const [idDetalle, setIdDetalle] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  // Aviso de éxito que deja el formulario al guardar (location.state).
  const [aviso, setAviso] = useState(() => location.state?.mensaje ?? '')

  // Se limpia el state del historial para que el aviso no reaparezca al recargar.
  useEffect(() => {
    if (location.state?.mensaje) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  const visibles = useMemo(
    () =>
      filas.filter(
        (f) =>
          (!mes || mesDe(f.fecha) === mes) &&
          (!busqueda ||
            [nombreProveedor(f), f.numero_factura, f.proveedor?.rut, normalizarRut(f.proveedor?.rut)].some((v) =>
              coincide(v, busqueda),
            )),
      ),
    [filas, mes, busqueda],
  )

  const filaDetalle = idDetalle ? filas.find((f) => f.id === idDetalle) : null
  const titulo = (f) => `Factura N° ${f.numero_factura} — ${nombreProveedor(f)}`

  const borrar = async (f) => {
    const n = numeroLineas(f)
    const mensaje =
      `¿Eliminar la factura N° ${f.numero_factura} de ${nombreProveedor(f)}?\n\n` +
      `Se borran sus ${n} ${n === 1 ? 'línea' : 'líneas'} y se descuenta del stock lo que esas líneas habían sumado. ` +
      'Las solicitudes que quedaron como "Comprada" siguen así.\n\nEsta acción no se puede deshacer.'
    if (!window.confirm(mensaje)) return
    setErrorAccion('')
    try {
      await eliminar(f.id)
    } catch (e) {
      setErrorAccion(mensajeError(e))
    }
  }

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar proveedor o N° factura…"
          aria-label="Buscar facturas"
          className={`${claseInput} pl-9`}
        />
      </div>
      <FiltroMes meses={mesesPresentes(filas)} valor={mes} onChange={setMes} />
    </>
  )

  const filtrando = busqueda || mes

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Facturas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Facturas de proveedores, de la más reciente a la más antigua. Neto, IVA y total se calculan desde las líneas
            y el descuento en %.
          </p>
        </div>
        <Link to="/facturas/nueva" className={claseBotonPrimario}>
          <Plus className="h-4 w-4" />
          Nueva factura
        </Link>
      </div>

      {aviso && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{aviso}</p>
          <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorAccion && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{errorAccion}</p>
          <button type="button" onClick={() => setErrorAccion('')} aria-label="Cerrar aviso" className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={visibles}
          nombreArchivo="facturas"
          cargando={cargando}
          error={error}
          vacio={filtrando ? 'Ninguna factura coincide con los filtros.' : 'Todavía no hay facturas.'}
          barra={barra}
          acciones={(f) => (
            <div className="inline-flex gap-1">
              <button
                type="button"
                onClick={() => setIdDetalle(f.id)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Ver detalles de la factura ${f.numero_factura}`}
                title="Ver detalles"
              >
                <Eye className="h-4 w-4" />
              </button>
              <Link
                to={`/facturas/${f.id}`}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                aria-label={`Editar la factura ${f.numero_factura}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => borrar(f)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar la factura ${f.numero_factura}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
        {!cargando && !error && (
          <div className="mt-2 text-right text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-800">{formatoCLP(visibles.reduce((s, f) => s + Number(f.total ?? 0), 0))}</span>{' '}
            ({visibles.length} {visibles.length === 1 ? 'factura' : 'facturas'})
          </div>
        )}
      </div>

      {filaDetalle && (
        <Modal titulo={titulo(filaDetalle)} onCerrar={() => setIdDetalle(null)} ancho="max-w-4xl">
          <DetalleFactura
            factura={filaDetalle}
            onEditar={() => navigate(`/facturas/${filaDetalle.id}`)}
            onCerrar={() => setIdDetalle(null)}
          />
        </Modal>
      )}
    </section>
  )
}

export default Facturas
