import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/contexto'
import { estaAnulado } from '../lib/anulacion'
import { errorSinFilas, mensajeError } from '../lib/errores'
import { formatoCLP, formatoFecha } from '../lib/formato'
import { numeroAEditable } from '../lib/numero'
import { avisoSobrepago, montoSugerido, puedeAgregarPago, saldoDe } from '../lib/pagos'
import { puedeBorrarPago, puedeEditarPago, puedeRegistrarPago } from '../lib/permisos'
import { hoyISO } from '../lib/solicitudes'
import { supabase } from '../lib/supabase'
import EtiquetaPago from './EtiquetaPago'
import FormularioPago from './FormularioPago'
import TablaDatos from './TablaDatos'

const SELECT = 'id, created_at, monto, fecha_pago, notas, perfil:perfiles!created_by(nombre_mostrar)'

const registradoPor = (p) => p.perfil?.nombre_mostrar ?? ''

const columnas = [
  { clave: 'fecha_pago', titulo: 'Fecha de pago', render: (p) => formatoFecha(p.fecha_pago), csv: (p) => p.fecha_pago },
  { clave: 'monto', titulo: 'Monto', alinear: 'derecha', render: (p) => formatoCLP(p.monto) },
  { clave: 'notas', titulo: 'Notas' },
  { clave: 'registrado', titulo: 'Registrado por', render: registradoPor, csv: registradoPor },
]

function CeldaResumen({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  )
}

// Cuotas/Pagos de una factura o boleta (en su ficha "Ver detalles"): lista de pagos,
// resumen Total / Pagado / Saldo y formulario para agregar uno. Contador y admin agregan;
// editar y borrar es solo del admin. Un documento anulado muestra sus pagos pero no admite
// agregar ni editar (la base no lo impide: lo impide la interfaz); el admin sí puede borrar.
// - `tipo`: 'factura' | 'boleta'; `documento`: la fila (total en `total` o `monto`).
// - `onCambio()`: se llama tras agregar, editar o borrar (para refrescar el estado del listado).
function PanelPagos({ tipo, documento, onCambio }) {
  const { perfil } = useAuth()
  const rol = perfil?.rol
  const columnaDocumento = tipo === 'factura' ? 'id_factura' : 'id_boleta'
  const total = tipo === 'factura' ? documento.total : documento.monto
  const anulado = estaAnulado(documento)

  const [pagos, setPagos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [edicion, setEdicion] = useState(null)

  // Cada cambio de `version` repite la consulta (tras agregar, editar o borrar).
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    supabase
      .from('pagos')
      .select(SELECT)
      .eq(columnaDocumento, documento.id)
      .order('fecha_pago')
      .order('created_at')
      .then(({ data, error: errorConsulta }) => {
        if (!vigente) return
        setPagos(data ?? [])
        setError(errorConsulta ?? null)
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [columnaDocumento, documento.id, version])

  const resumen = saldoDe(total, pagos)
  const puedeAgregar = puedeRegistrarPago(rol) && puedeAgregarPago(documento)
  const puedeEditar = puedeEditarPago(rol) && puedeAgregarPago(documento)
  const puedeBorrar = puedeBorrarPago(rol)

  const tras = () => {
    setEdicion(null)
    setVersion((v) => v + 1)
    onCambio?.()
  }

  const agregar = async (datos) => {
    const { error: errorInsertar } = await supabase.from('pagos').insert({ ...datos, [columnaDocumento]: documento.id })
    if (errorInsertar) throw errorInsertar
    tras()
  }

  const editar = async (datos) => {
    const { data, error: errorActualizar } = await supabase.from('pagos').update(datos).eq('id', edicion.id).select('id')
    const fallo = errorActualizar ?? errorSinFilas(data)
    if (fallo) throw fallo
    tras()
  }

  const borrar = async (pago) => {
    const pregunta = `¿Eliminar el pago de ${formatoCLP(pago.monto)} del ${formatoFecha(pago.fecha_pago)}?`
    if (!window.confirm(`${pregunta} Esta acción no se puede deshacer.`)) return
    setErrorAccion('')
    const { data, error } = await supabase.from('pagos').delete().eq('id', pago.id).select('id')
    const errorBorrar = error ?? errorSinFilas(data)
    if (errorBorrar) return setErrorAccion(mensajeError(errorBorrar))
    tras()
  }

  const botonesFila =
    puedeEditar || puedeBorrar
      ? (p) => (
          <div className="inline-flex gap-1">
            {puedeEditar && (
              <button
                type="button"
                onClick={() => setEdicion(p)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-darker"
                aria-label={`Editar el pago del ${formatoFecha(p.fecha_pago)}`}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {puedeBorrar && (
              <button
                type="button"
                onClick={() => borrar(p)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Eliminar el pago del ${formatoFecha(p.fecha_pago)}`}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      : undefined

  return (
    <div className="mt-1 space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CeldaResumen etiqueta="Total">{formatoCLP(resumen.total)}</CeldaResumen>
        <CeldaResumen etiqueta="Pagado">{formatoCLP(resumen.pagado)}</CeldaResumen>
        <CeldaResumen etiqueta="Saldo">{formatoCLP(resumen.saldo)}</CeldaResumen>
        <CeldaResumen etiqueta="Estado">
          <EtiquetaPago fila={{ estado_pago: anulado ? 'anulado' : resumen.estado, saldo: resumen.saldo }} />
        </CeldaResumen>
      </dl>

      {anulado && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Documento anulado: se muestran sus pagos, pero no se pueden agregar ni editar. Dejan de contar en el Resumen
          mientras siga anulado.
        </p>
      )}
      {!anulado && resumen.sobrepago && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Lo pagado supera el total del documento en {formatoCLP(-resumen.saldo)}.
        </p>
      )}

      {errorAccion && (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{errorAccion}</span>
          <button type="button" onClick={() => setErrorAccion('')} aria-label="Cerrar aviso">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      <TablaDatos
        columnas={columnas}
        filas={pagos}
        nombreArchivo={`pagos-${tipo}-${documento.numero_factura ?? documento.numero_documento ?? documento.id}`}
        cargando={cargando}
        error={error}
        vacio="Todavía no hay pagos registrados."
        acciones={botonesFila}
      />

      {/* Se montan con los pagos ya cargados; la key reinicia el formulario tras cada cambio
          para que el monto sugerido (el saldo) se actualice. Editar y agregar comparten lugar
          (sin modal anidado dentro de la ficha). */}
      {!cargando && edicion && puedeEditar && (
        <FormularioPago
          key={`editar-${edicion.id}`}
          valoresIniciales={{ monto: numeroAEditable(edicion.monto), fecha: edicion.fecha_pago, notas: edicion.notas }}
          avisoSobrepago={(m) => avisoSobrepago(resumen.total, resumen.pagado - Number(edicion.monto), m)}
          onGuardar={editar}
          onCancelar={() => setEdicion(null)}
          textoBoton="Guardar cambios"
        />
      )}
      {!cargando && !edicion && puedeAgregar && (
        <FormularioPago
          key={`nuevo-${pagos.map((p) => p.id).join()}`}
          valoresIniciales={{ monto: numeroAEditable(montoSugerido(resumen.total, resumen.pagado)), fecha: hoyISO(), notas: '' }}
          avisoSobrepago={(m) => avisoSobrepago(resumen.total, resumen.pagado, m)}
          onGuardar={agregar}
          textoBoton="Agregar pago"
        />
      )}
    </div>
  )
}

export default PanelPagos
