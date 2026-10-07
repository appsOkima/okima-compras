import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import AccionAnulacion from '../../components/AccionAnulacion'
import EtiquetaAnulada from '../../components/EtiquetaAnulada'
import EtiquetaPago from '../../components/EtiquetaPago'
import FiltroEstadoPago from '../../components/FiltroEstadoPago'
import FiltroMes from '../../components/FiltroMes'
import Interruptor from '../../components/Interruptor'
import Modal from '../../components/Modal'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonPrimario, claseInput } from '../../components/estilos'
import { useAuth } from '../../auth/contexto'
import { useEstadosPago } from '../../hooks/useEstadosPago'
import { useTabla } from '../../hooks/useTabla'
import { estaAnulado, vigentes } from '../../lib/anulacion'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha, formatoNumero } from '../../lib/formato'
import { etiquetaMes, mesDe, mesesPresentes, sumaCampo } from '../../lib/gastos'
import { puedeHacer } from '../../lib/permisos'
import { mensajeBorradoDocumento, textoEstadoPago } from '../../lib/pagos'
import { hoyISO } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import { coincide, normalizarRut } from '../../lib/texto'
import DetalleFactura from './DetalleFactura'

// De las líneas basta la cantidad (el detalle las consulta al abrirse). perfil_anulo:
// quién la anuló (la FK anulado_por se nombra para no confundirla con created_by).
const SELECT =
  '*, proveedor:proveedores(id, nombre, rut), perfil_anulo:perfiles!anulado_por(nombre_mostrar), lineas:detalle_facturas(count)'

// Solicitudes vinculadas a las líneas de una factura, para avisar antes de anularla.
const cargarSolicitudes = async (idFactura) => {
  const { data, error } = await supabase
    .from('detalle_facturas')
    .select('solicitud:solicitudes_compra!id_solicitud_compra(id, estado, solicitante, insumo:insumos(nombre))')
    .eq('id_factura', idFactura)
    .not('id_solicitud_compra', 'is', null)
  if (error) throw error
  return data
}

// Más reciente primero; a igual fecha, la última ingresada arriba.
const ORDEN = { columna: 'fecha', ascendente: false, luego: { columna: 'created_at', ascendente: false } }

const nombreProveedor = (f) => f.proveedor?.nombre ?? ''
const numeroLineas = (f) => f.lineas?.[0]?.count ?? 0
const monto = (clave) => (f) => <span className="whitespace-nowrap">{formatoCLP(f[clave])}</span>

// Estado de pago de cada factura (vista_estado_pago, ver useEstadosPago).
const columnasFacturas = (estados) => [
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
  {
    clave: 'estado_documento',
    titulo: 'Estado',
    render: (f) => (estaAnulado(f) ? <EtiquetaAnulada /> : ''),
    csv: (f) => f.estado_documento ?? 'vigente',
  },
  {
    clave: 'estado_pago',
    titulo: 'Pago',
    render: (f) => <EtiquetaPago fila={estados.get(f.id)} />,
    csv: (f) => textoEstadoPago(estados.get(f.id)),
  },
]

// Listado de facturas (totales ya calculados al guardar). Crear y editar abren el
// formulario maestro-detalle en su propia página (/facturas/nueva, /facturas/:id).
function Facturas() {
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil } = useAuth()
  const puedeCrear = puedeHacer(perfil?.rol, 'facturas', 'crear')
  const puedeEditar = puedeHacer(perfil?.rol, 'facturas', 'editar')
  const puedeBorrar = puedeHacer(perfil?.rol, 'facturas', 'borrar')
  const { filas, cargando, error, actualizar, eliminar } = useTabla('facturas', { select: SELECT, orden: ORDEN })
  const { estados, recargar: recargarEstados } = useEstadosPago('factura')
  const columnas = useMemo(() => columnasFacturas(estados), [estados])
  const [busqueda, setBusqueda] = useState('')
  // '' = todos; si no, pagado | pendiente | parcial.
  const [estadoPago, setEstadoPago] = useState('')
  // '' = todos los meses; si no, 'YYYY-MM'.
  const [mes, setMes] = useState('')
  // Las anuladas se ocultan por defecto (como los inactivos de los Mantenedores).
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false)
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
          (mostrarAnuladas || !estaAnulado(f)) &&
          (!mes || mesDe(f.fecha) === mes) &&
          (!estadoPago || estados.get(f.id)?.estado_pago === estadoPago) &&
          (!busqueda ||
            [nombreProveedor(f), f.numero_factura, f.proveedor?.rut, normalizarRut(f.proveedor?.rut)].some((v) =>
              coincide(v, busqueda),
            )),
      ),
    [filas, mes, busqueda, mostrarAnuladas, estadoPago, estados],
  )
  const totalAnuladas = useMemo(() => filas.filter(estaAnulado).length, [filas])

  // IVA del mes filtrado o, sin filtro, del mes en curso. Suma todas las facturas
  // vigentes de ese mes (no depende de la búsqueda): es el IVA de compras del mes.
  const mesIva = mes || mesDe(hoyISO())
  const ivaDelMes = useMemo(
    () =>
      sumaCampo(
        filas.filter((f) => mesDe(f.fecha) === mesIva),
        'iva',
      ),
    [filas, mesIva],
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
      setErrorAccion(mensajeBorradoDocumento(e) ?? mensajeError(e))
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
      <FiltroEstadoPago valor={estadoPago} onChange={setEstadoPago} />
      <Interruptor activo={mostrarAnuladas} onCambiar={setMostrarAnuladas}>
        Mostrar anuladas
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            totalAnuladas > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {totalAnuladas}
        </span>
      </Interruptor>
    </>
  )

  const filtrando = busqueda || mes || estadoPago

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
        {puedeCrear && (
          <Link to="/facturas/nueva" className={claseBotonPrimario}>
            <Plus className="h-4 w-4" />
            Nueva factura
          </Link>
        )}
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
          claseFila={(f) => (estaAnulado(f) ? 'opacity-60' : '')}
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
              {puedeEditar && !estaAnulado(f) && (
                <Link
                  to={`/facturas/${f.id}`}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700"
                  aria-label={`Editar la factura ${f.numero_factura}`}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              )}
              <AccionAnulacion
                tipo="factura"
                doc={f}
                nombre={`N° ${f.numero_factura}`}
                onCambiar={async (datos) => {
                  await actualizar(f.id, datos)
                  recargarEstados()
                }}
                cargarSolicitudes={cargarSolicitudes}
              />
              {puedeBorrar && (
                <button
                  type="button"
                  onClick={() => borrar(f)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Eliminar la factura ${f.numero_factura}`}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        />
        {!cargando && !error && (
          <div className="mt-2 flex flex-col items-end gap-1 text-sm text-slate-600">
            <div>
              IVA de {etiquetaMes(mesIva)}
              {!mes && ' (mes en curso)'}:{' '}
              <span className="font-semibold text-slate-800">{formatoCLP(ivaDelMes)}</span>
            </div>
            <div>
              {/* Las anuladas que se muestren no suman ni se cuentan. */}
              Total: <span className="font-semibold text-slate-800">{formatoCLP(sumaCampo(visibles, 'total'))}</span>{' '}
              ({vigentes(visibles).length} {vigentes(visibles).length === 1 ? 'factura' : 'facturas'})
            </div>
          </div>
        )}
      </div>

      {filaDetalle && (
        <Modal titulo={titulo(filaDetalle)} onCerrar={() => setIdDetalle(null)} ancho="max-w-4xl">
          <DetalleFactura
            factura={filaDetalle}
            onEditar={!puedeEditar || estaAnulado(filaDetalle) ? undefined : () => navigate(`/facturas/${filaDetalle.id}`)}
            onCerrar={() => setIdDetalle(null)}
            onPagosCambiaron={recargarEstados}
          />
        </Modal>
      )}
    </section>
  )
}

export default Facturas
