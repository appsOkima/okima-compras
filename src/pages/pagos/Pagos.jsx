import { useMemo, useState } from 'react'
import { AlertCircle, Pencil, Search, Trash2, X } from 'lucide-react'
import EtiquetaAnulada from '../../components/EtiquetaAnulada'
import FiltroMes from '../../components/FiltroMes'
import FormularioPago from '../../components/FormularioPago'
import Modal from '../../components/Modal'
import TablaDatos from '../../components/TablaDatos'
import { claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { errorSinFilas, mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha } from '../../lib/formato'
import { mesDe } from '../../lib/gastos'
import { numeroAEditable } from '../../lib/numero'
import { avisoSobrepago, documentoDePago, totalPagosVigentes } from '../../lib/pagos'
import { supabase } from '../../lib/supabase'
import { coincide } from '../../lib/texto'

// Documento del pago y quién lo registró. Las dos FK a perfiles de facturas (created_by,
// anulado_by) no se embeben aquí: solo el documento y su proveedor.
const SELECT =
  '*, factura:facturas(numero_factura, estado_documento, proveedor:proveedores(nombre)), boleta:boletas(concepto, estado_documento), perfil:perfiles!created_by(nombre_mostrar)'

// Más reciente primero; a igual fecha, el último registrado arriba.
const ORDEN = { columna: 'fecha_pago', ascendente: false, luego: { columna: 'created_at', ascendente: false } }

const textoDocumento = (p) => documentoDePago(p).texto
const registradoPor = (p) => p.perfil?.nombre_mostrar ?? ''

const columnas = [
  {
    clave: 'fecha_pago',
    titulo: 'Fecha de pago',
    render: (p) => <span className="whitespace-nowrap">{formatoFecha(p.fecha_pago)}</span>,
    csv: (p) => p.fecha_pago,
  },
  {
    clave: 'documento',
    titulo: 'Documento',
    render: (p) => (
      <>
        {textoDocumento(p)} {documentoDePago(p).anulado && <EtiquetaAnulada />}
      </>
    ),
    csv: (p) => `${textoDocumento(p)}${documentoDePago(p).anulado ? ' (anulado)' : ''}`,
  },
  {
    clave: 'monto',
    titulo: 'Monto',
    alinear: 'derecha',
    render: (p) => <span className="whitespace-nowrap">{formatoCLP(p.monto)}</span>,
  },
  { clave: 'notas', titulo: 'Notas' },
  { clave: 'registrado', titulo: 'Registrado por', render: registradoPor, csv: registradoPor },
]

// Sección global de pagos (solo Admin): todos los pagos de facturas y boletas, con
// edición y borrado. Los pagos de documentos anulados se muestran marcados y no suman
// en el total del filtro (como en el Resumen).
function Pagos() {
  const { filas, cargando, error, recargar } = useTabla('pagos', { select: SELECT, orden: ORDEN })
  const [busqueda, setBusqueda] = useState('')
  // '' = todos los meses; si no, 'YYYY-MM' (del mes del pago).
  const [mes, setMes] = useState('')
  // { pago, total, pagadoOtros } mientras se edita; el total y lo ya pagado salen del documento.
  const [edicion, setEdicion] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')

  const visibles = useMemo(
    () =>
      filas.filter(
        (p) =>
          (!mes || mesDe(p.fecha_pago) === mes) &&
          (!busqueda || [textoDocumento(p), p.notas, registradoPor(p)].some((v) => coincide(v, busqueda))),
      ),
    [filas, mes, busqueda],
  )
  const meses = useMemo(
    () => [...new Set(filas.map((p) => mesDe(p.fecha_pago)).filter(Boolean))].sort().reverse(),
    [filas],
  )

  const abrirEdicion = async (pago) => {
    setErrorAccion('')
    const { tipo } = documentoDePago(pago)
    const { data, error: errorConsulta } = await supabase
      .from('vista_estado_pago')
      .select('total, pagado')
      .eq('tipo', tipo)
      .eq('id_documento', pago.id_factura ?? pago.id_boleta)
      .single()
    if (errorConsulta) return setErrorAccion(mensajeError(errorConsulta))
    setEdicion({ pago, total: data.total, pagadoOtros: Number(data.pagado) - Number(pago.monto) })
  }

  const guardarEdicion = async (datos) => {
    const { data, error: errorActualizar } = await supabase.from('pagos').update(datos).eq('id', edicion.pago.id).select('id')
    const fallo = errorActualizar ?? errorSinFilas(data)
    if (fallo) throw fallo
    setEdicion(null)
    await recargar({ silencioso: true })
  }

  const borrar = async (pago) => {
    const pregunta = `¿Eliminar el pago de ${formatoCLP(pago.monto)} del ${formatoFecha(pago.fecha_pago)} (${textoDocumento(pago)})?`
    if (!window.confirm(`${pregunta} Esta acción no se puede deshacer.`)) return
    setErrorAccion('')
    const { data, error } = await supabase.from('pagos').delete().eq('id', pago.id).select('id')
    const errorBorrar = error ?? errorSinFilas(data)
    if (errorBorrar) return setErrorAccion(mensajeError(errorBorrar))
    await recargar({ silencioso: true })
  }

  const barra = (
    <>
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar documento, nota o usuario…"
          aria-label="Buscar pagos"
          className={`${claseInput} pl-9`}
        />
      </div>
      <FiltroMes meses={meses} valor={mes} onChange={setMes} />
    </>
  )

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold text-slate-800">Pagos</h2>
      <p className="mt-1 text-sm text-slate-600">
        Todos los pagos de facturas y boletas, del más reciente al más antiguo. Se agregan desde Cuotas/Pagos en la ficha
        de cada documento.
      </p>

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
          nombreArchivo="pagos"
          cargando={cargando}
          error={error}
          vacio={busqueda || mes ? 'Ningún pago coincide con los filtros.' : 'Todavía no hay pagos.'}
          barra={barra}
          claseFila={(p) => (documentoDePago(p).anulado ? 'opacity-60' : '')}
          acciones={(p) => (
            <div className="inline-flex gap-1">
              {!documentoDePago(p).anulado && (
                <button
                  type="button"
                  onClick={() => abrirEdicion(p)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-darker"
                  aria-label={`Editar el pago de ${textoDocumento(p)}`}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => borrar(p)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar el pago de ${textoDocumento(p)}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        />
        {!cargando && !error && (
          <div className="mt-2 text-right text-sm text-slate-600">
            {/* Los pagos de documentos anulados que se muestren no suman. */}
            Total: <span className="font-semibold text-slate-800">{formatoCLP(totalPagosVigentes(visibles))}</span>
          </div>
        )}
      </div>

      {edicion && (
        <Modal titulo={`Editar pago: ${textoDocumento(edicion.pago)}`} onCerrar={() => setEdicion(null)}>
          <FormularioPago
            valoresIniciales={{
              monto: numeroAEditable(edicion.pago.monto),
              fecha: edicion.pago.fecha_pago,
              notas: edicion.pago.notas,
            }}
            avisoSobrepago={(m) => avisoSobrepago(edicion.total, edicion.pagadoOtros, m)}
            onGuardar={guardarEdicion}
            onCancelar={() => setEdicion(null)}
            textoBoton="Guardar cambios"
          />
        </Modal>
      )}
    </section>
  )
}

export default Pagos
