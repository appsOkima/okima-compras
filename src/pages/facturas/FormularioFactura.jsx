import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2, Plus, Save } from 'lucide-react'
import CampoNotas from '../../components/CampoNotas'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import InputNumero from '../../components/InputNumero'
import SwitchPagoContado from '../../components/SwitchPagoContado'
import { useSolicitudesOcupadas } from '../../hooks/useSolicitudesOcupadas'
import { useTabla } from '../../hooks/useTabla'
import { estaAnulado } from '../../lib/anulacion'
import { errorSinFilas, mensajeError } from '../../lib/errores'
import {
  aNumero,
  aplicarCambioLinea,
  calcularTotales,
  datosCabecera,
  datosLinea,
  decidirVinculo,
  descuentoEditable,
  diffLineas,
  erroresCabecera,
  erroresLinea,
  lineaDesdeBase,
  lineaVacia,
  ordenarSolicitudesParaLinea,
  vinculoPropuesto,
  vinculosAAplicar,
} from '../../lib/facturas'
import { formatoCLP, formatoNumero } from '../../lib/formato'
import { mensajePagoCreacion, pagoAlContado } from '../../lib/pagos'
import { hoyISO, opcionSolicitud, solicitudesDisponibles } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import { validarFactor } from '../../lib/vinculos'
import Campo from './Campo'
import DetalleFactura from './DetalleFactura'
import LineaFactura from './LineaFactura'
import SelectorProveedorFactura from './SelectorProveedorFactura'

const SELECT_PROVEEDORES = 'id, nombre, rut'
// vinculos: filas de la pivote insumos_proveedores_okima (N:M con insumos Okima).
const SELECT_CATALOGO =
  'id, nombre, codigo, id_proveedor, cantidad_formato, formato_unidad, vinculos:insumos_proveedores_okima(id_insumo_okima, factor_conversion, insumo:insumos(id, nombre))'
const SELECT_PENDIENTES =
  'id, created_at, id_insumo_okima, insumo_nombre, cantidad_solicitada, solicitante, nivel_urgencia, fecha_esperada'
const ORDEN_PENDIENTES = { columna: 'created_at', ascendente: true }
// Las líneas traen el stock que aplicó el trigger (movimientos_stock, para el aviso
// de stock) y su solicitud, que ya no está en la vista de pendientes porque quedó
// 'Comprada'.
// `*`, proveedor y perfil_anulo también alimentan la vista de solo lectura de una factura
// anulada (no se edita desde la interfaz).
const SELECT_FACTURA =
  '*, proveedor:proveedores(id, nombre, rut), perfil_anulo:perfiles!anulado_por(nombre_mostrar), ' +
  'lineas:detalle_facturas(id, created_at, id_insumo_proveedor, id_solicitud_compra, cantidad, precio_neto, descuento_pct, subtotal, ' +
  'movimientos:movimientos_stock(qty, insumo:insumos(nombre)), ' +
  'solicitud:solicitudes_compra!id_solicitud_compra(id, created_at, id_insumo_okima, cantidad_solicitada, solicitante, nivel_urgencia, fecha_esperada, estado, insumo:insumos(nombre)))'

const claseTarjeta = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
const claseError = ' border-red-400 focus:border-red-500 focus:ring-red-500/30'

// Neto, IVA y total no son parte del estado: se calculan desde las líneas.
function cabeceraVacia() {
  return { id_proveedor: '', numero_factura: '', fecha: hoyISO(), descuento_pct: '', notas: '' }
}

// «insumo del proveedor» con «insumo Okima», para los mensajes de vínculos.
const parVinculo = (v) => `«${v.nombreInsumoProveedor}» con «${v.nombreInsumoOkima}»`

// /facturas/nueva y /facturas/:id. La key reinicia el formulario si cambia la ruta.
function PaginaFactura() {
  const { id } = useParams()
  return <FormularioFactura key={id ?? 'nueva'} id={id ?? null} />
}

// Formulario maestro-detalle de una factura (página completa, no modal).
// Guardado sin RPC (el cliente de Supabase no hace transacciones de varias
// sentencias): cabecera y luego líneas. Subtotales, neto, IVA y total se calculan
// en vivo y se guardan ya calculados. Stock y solicitudes 'Comprada' los
// resuelven los triggers de detalle_facturas. Si una línea con solicitud tiene un
// insumo del proveedor sin vincular, se pregunta si vincularlo con el insumo
// Okima de la solicitud; los vínculos aceptados se aplican antes que las líneas.
function FormularioFactura({ id }) {
  const navigate = useNavigate()
  const esNueva = id === null
  const {
    filas: proveedores,
    cargando: cargandoProveedores,
    error: errorProveedores,
    crear: crearProveedor,
  } = useTabla('proveedores', { select: SELECT_PROVEEDORES })
  const {
    filas: catalogo,
    cargando: cargandoCatalogo,
    error: errorCatalogo,
    crear: crearInsumoProveedor,
    recargar: recargarCatalogo,
  } = useTabla('insumos_proveedores', { select: SELECT_CATALOGO })
  const {
    filas: pendientes,
    cargando: cargandoPendientes,
    error: errorPendientes,
  } = useTabla('vista_solicitudes_pendientes', { select: SELECT_PENDIENTES, orden: ORDEN_PENDIENTES })
  // Solicitudes ya vinculadas a líneas de boleta: no se ofrecen aquí (exclusividad).
  const ocupadasPorBoletas = useSolicitudesOcupadas('detalle_boletas')

  // Claves locales de las líneas nuevas (las guardadas usan su id).
  const siguienteClave = useRef(0)
  const nuevaClave = () => `nueva-${++siguienteClave.current}`

  // 'cargando' | 'lista' | 'no-encontrada' | 'error'
  const [carga, setCarga] = useState(esNueva ? 'lista' : 'cargando')
  const [errorCarga, setErrorCarga] = useState(null)
  const [numeroOriginal, setNumeroOriginal] = useState('')
  // Factura anulada: se muestra en solo lectura (la base tampoco deja editarla).
  const [anulada, setAnulada] = useState(null)
  const [cabecera, setCabecera] = useState(cabeceraVacia)
  const [lineas, setLineas] = useState(() => [lineaVacia('nueva-0')])
  // Líneas tal como están guardadas: base del diff al editar.
  const [originales, setOriginales] = useState([])
  const [sucio, setSucio] = useState(false)
  const [errores, setErrores] = useState({ cabecera: {}, lineas: {} })
  const [errorGuardar, setErrorGuardar] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Solo al crear: registra un pago por el total al terminar de guardar. No cuenta como
  // cambio sin guardar (no toca `sucio`).
  const [alContado, setAlContado] = useState(true)

  useEffect(() => {
    if (esNueva) return
    let vigente = true
    supabase
      .from('facturas')
      .select(SELECT_FACTURA)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error || !data) {
          // 22P02: el id de la URL no es un uuid válido.
          setCarga(!error || error.code === '22P02' ? 'no-encontrada' : 'error')
          setErrorCarga(error)
          return
        }
        if (estaAnulado(data)) {
          setAnulada(data)
          setCarga('lista')
          return
        }
        const guardadas = [...(data.lineas ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        setCabecera({
          id_proveedor: data.id_proveedor,
          numero_factura: data.numero_factura,
          fecha: data.fecha,
          descuento_pct: descuentoEditable(data.descuento_pct),
          notas: data.notas ?? '',
        })
        setOriginales(guardadas)
        setLineas(guardadas.length > 0 ? guardadas.map(lineaDesdeBase) : [lineaVacia(`nueva-${++siguienteClave.current}`)])
        setNumeroOriginal(data.numero_factura)
        setCarga('lista')
      })
    return () => {
      vigente = false
    }
  }, [esNueva, id])

  const catalogoPorId = useMemo(() => new Map(catalogo.map((item) => [item.id, item])), [catalogo])
  const catalogoProveedor = useMemo(
    () => catalogo.filter((item) => item.id_proveedor === cabecera.id_proveedor),
    [catalogo, cabecera.id_proveedor],
  )
  const originalesPorId = useMemo(() => new Map(originales.map((o) => [o.id, o])), [originales])

  // Pendientes + las ya asociadas a esta factura (ya 'Comprada'), sin repetir, y sin
  // las vinculadas a boletas (salvo las de esta factura).
  const solicitudes = useMemo(() => {
    const lista = [...pendientes]
    const ids = new Set(lista.map((s) => s.id))
    for (const { solicitud } of originales) {
      if (solicitud && !ids.has(solicitud.id)) {
        ids.add(solicitud.id)
        lista.push({ ...solicitud, insumo_nombre: solicitud.insumo?.nombre ?? '' })
      }
    }
    const propias = originales.map((o) => o.id_solicitud_compra).filter(Boolean)
    return solicitudesDisponibles(lista, ocupadasPorBoletas, propias)
  }, [pendientes, originales, ocupadasPorBoletas])
  const solicitudesPorId = useMemo(() => new Map(solicitudes.map((s) => [s.id, s])), [solicitudes])

  // Vínculos aceptados que se aplicarán al guardar; por insumo del proveedor.
  const vinculos = vinculosAAplicar(lineas, catalogoPorId, solicitudesPorId)
  const vinculosPendientesDe = (idInsumoProveedor) => vinculos.filter((v) => v.idInsumoProveedor === idInsumoProveedor)

  // Una solicitud se asocia a una sola línea: se ocultan las elegidas en otras.
  const opcionesSolicitudPara = (linea) => {
    const enOtras = new Set(
      lineas.filter((l) => l.clave !== linea.clave && l.id_solicitud_compra).map((l) => l.id_solicitud_compra),
    )
    const idsInsumoOkima = [
      ...(catalogoPorId.get(linea.id_insumo_proveedor)?.vinculos ?? []).map((v) => v.id_insumo_okima),
      ...vinculosPendientesDe(linea.id_insumo_proveedor).map((v) => v.idInsumoOkima),
    ]
    return ordenarSolicitudesParaLinea(
      solicitudes.filter((s) => !enOtras.has(s.id)),
      idsInsumoOkima,
    ).map((s) => opcionSolicitud(s, idsInsumoOkima))
  }

  // Totales en vivo: son los mismos que se guardan (ver datosCabecera).
  const totales = calcularTotales(lineas, cabecera.descuento_pct)

  const limpiarError = (grupo, clave, campo) =>
    setErrores((actuales) =>
      grupo === 'cabecera'
        ? { ...actuales, cabecera: { ...actuales.cabecera, [campo]: undefined } }
        : { ...actuales, lineas: { ...actuales.lineas, [clave]: { ...actuales.lineas[clave], [campo]: undefined } } },
    )

  const cambiarCabecera = (campo, valor) => {
    setCabecera((actual) => ({ ...actual, [campo]: valor }))
    limpiarError('cabecera', null, campo)
    setSucio(true)
  }

  // Los insumos de las líneas son del catálogo del proveedor: al cambiarlo se
  // confirma y se quitan los del proveedor anterior. Escribir encima del
  // proveedor (valor '') no toca las líneas; se decide al elegir otro.
  const cambiarProveedor = (nuevoId) => {
    if (nuevoId) {
      // Solo cuentan los insumos ya cargados del catálogo (si aún carga, no se sabe de quién son).
      const ajenas = lineas.filter((l) => {
        const item = catalogoPorId.get(l.id_insumo_proveedor)
        return item && item.id_proveedor !== nuevoId
      })
      if (ajenas.length > 0) {
        const n = ajenas.length
        const confirmado = window.confirm(
          `${n === 1 ? 'Hay 1 línea' : `Hay ${n} líneas`} con insumos del proveedor anterior. ` +
            'Al cambiar el proveedor se quita el insumo de esas líneas (cantidades y precios se conservan). ¿Continuar?',
        )
        if (!confirmado) {
          // Se vuelve al proveedor de esas líneas.
          const anterior = catalogoPorId.get(ajenas[0].id_insumo_proveedor).id_proveedor
          setCabecera((actual) => ({ ...actual, id_proveedor: anterior }))
          return
        }
        const claves = new Set(ajenas.map((l) => l.clave))
        setLineas((actuales) =>
          actuales.map((l) => (claves.has(l.clave) ? aplicarCambioLinea(l, 'id_insumo_proveedor', '') : l)),
        )
      }
    }
    cambiarCabecera('id_proveedor', nuevoId)
  }

  const cambiarLinea = (clave, campo, valor) => {
    setLineas((actuales) => actuales.map((l) => (l.clave === clave ? aplicarCambioLinea(l, campo, valor) : l)))
    limpiarError('lineas', clave, campo)
    setSucio(true)
  }

  const decidirVinculoLinea = (clave, propuesta, acepta) => {
    setLineas((actuales) => actuales.map((l) => (l.clave === clave ? decidirVinculo(l, propuesta, acepta) : l)))
    setSucio(true)
  }

  const agregarLinea = () => {
    setLineas((actuales) => [...actuales, lineaVacia(nuevaClave())])
    setSucio(true)
  }

  const quitarLinea = (clave) => {
    setLineas((actuales) => actuales.filter((l) => l.clave !== clave))
    setSucio(true)
  }

  // Vínculos aceptados (filas de la pivote), antes que la cabecera y las líneas:
  // así las líneas nuevas ya mueven stock (el trigger lee la pivote al insertar).
  // Si el par ya existe (23505: lo hizo otra persona entre tanto) no se pisa y
  // queda en `omitidos`. Si uno falla no se sigue guardando.
  const aplicarVinculos = async () => {
    const aplicados = []
    const omitidos = []
    for (const v of vinculos) {
      const { error } = await supabase.from('insumos_proveedores_okima').insert({
        id_insumo_proveedor: v.idInsumoProveedor,
        id_insumo_okima: v.idInsumoOkima,
        factor_conversion: v.factor,
      })
      if (error?.code === '23505') {
        omitidos.push(v)
      } else if (error) {
        const previos = aplicados.length > 0 ? ` Sí quedó vinculado: ${aplicados.map(parVinculo).join(', ')}.` : ''
        throw new Error(
          `No se pudo vincular ${parVinculo(v)}: ${mensajeError(error).replace(/\.$/, '')}. ` +
            `${esNueva ? 'No se guardó la factura.' : 'No se guardaron los cambios de la factura.'}${previos}`,
        )
      } else {
        aplicados.push(v)
      }
    }
    return { aplicados, omitidos }
  }

  // Nueva: cabecera y luego todas las líneas en un solo insert (todas o ninguna).
  // Si fallan las líneas se borra la cabecera para no dejar una factura vacía.
  // Devuelve el id de la factura creada.
  const crearFactura = async (datosCab, datosLineas) => {
    const { data, error } = await supabase.from('facturas').insert(datosCab).select('id').single()
    if (error) throw error
    const { error: errorLineas } = await supabase
      .from('detalle_facturas')
      .insert(datosLineas.map((l) => ({ ...l, id_factura: data.id })))
    if (!errorLineas) return data.id
    const { error: errorBorrar } = await supabase.from('facturas').delete().eq('id', data.id)
    if (errorBorrar) {
      throw new Error(
        `No se pudieron guardar las líneas (${mensajeError(errorLineas)}) y la factura quedó sin líneas: ` +
          'edítala o bórrala desde el listado.',
      )
    }
    throw errorLineas
  }

  // Edición: cabecera y luego el diff de líneas (borrar, actualizar, insertar).
  // Si algo falla a medio camino, lo ya aplicado pasa a ser la base del diff
  // para que volver a guardar no duplique ni repita cambios.
  const actualizarFactura = async (datosCab, datosLineas) => {
    const { data, error } = await supabase.from('facturas').update(datosCab).eq('id', id).select('id')
    const fallo = error ?? errorSinFilas(data)
    if (fallo) throw fallo
    const { eliminar, actualizar, insertar } = diffLineas(originales, datosLineas)
    let vigentes = originales
    try {
      if (eliminar.length > 0) {
        const { data, error: errorEliminar } = await supabase.from('detalle_facturas').delete().in('id', eliminar).select('id')
        const fallo = errorEliminar ?? errorSinFilas(data, eliminar.length)
        if (fallo) throw fallo
        vigentes = vigentes.filter((o) => !eliminar.includes(o.id))
      }
      for (const { id: idLinea, datos } of actualizar) {
        const { data, error: errorActualizar } = await supabase.from('detalle_facturas').update(datos).eq('id', idLinea).select('id')
        const fallo = errorActualizar ?? errorSinFilas(data)
        if (fallo) throw fallo
        vigentes = vigentes.map((o) => (o.id === idLinea ? { ...o, ...datos } : o))
      }
      if (insertar.length > 0) {
        const { error: errorInsertar } = await supabase
          .from('detalle_facturas')
          .insert(insertar.map((l) => ({ ...l, id_factura: id })))
        if (errorInsertar) throw errorInsertar
      }
    } catch (e) {
      setOriginales(vigentes)
      throw new Error(
        `Se guardó la cabecera, pero no se terminaron de guardar las líneas: ${mensajeError(e)} ` +
          'Lo ya aplicado quedó guardado; corrige y vuelve a guardar.',
      )
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return

    const datosCab = datosCabecera(cabecera, lineas)
    const erroresCab = erroresCabecera(datosCab)
    const datosLineas = lineas.map(datosLinea)
    const erroresLineas = {}
    lineas.forEach((l, i) => {
      const errLinea = erroresLinea(datosLineas[i])
      if (Object.keys(errLinea).length > 0) erroresLineas[l.clave] = errLinea
    })
    setErrores({ cabecera: erroresCab, lineas: erroresLineas })
    const sinFactor = vinculos.find((v) => validarFactor(v.factor))
    if (sinFactor) {
      setErrorGuardar(`Revisa el factor de conversión de ${parVinculo(sinFactor)}: debe ser un número mayor que 0.`)
      return
    }
    if (lineas.length === 0) {
      setErrorGuardar('Agrega al menos una línea.')
      return
    }
    if (Object.keys(erroresCab).length > 0 || Object.keys(erroresLineas).length > 0) {
      setErrorGuardar('Revisa los campos marcados.')
      return
    }

    setErrorGuardar('')
    setGuardando(true)
    let resultadoVinculos = null
    try {
      resultadoVinculos = await aplicarVinculos()
      let textoPago = ''
      if (esNueva) {
        const idFactura = await crearFactura(datosCab, datosLineas)
        // Último paso: con la factura y sus líneas ya guardadas. Si el pago falla no se
        // deshace nada: el aviso lo manda a registrarlo desde Cuotas/Pagos.
        const pago = alContado ? pagoAlContado('factura', idFactura, datosCab.total, datosCab.fecha) : null
        let motivoError
        if (pago) {
          const { error: errorPago } = await supabase.from('pagos').insert(pago)
          if (errorPago) motivoError = mensajeError(errorPago).replace(/\.$/, '')
        }
        textoPago = mensajePagoCreacion({ alContado, pago, motivoError })
      } else await actualizarFactura(datosCab, datosLineas)
      const { aplicados, omitidos } = resultadoVinculos
      const notas = [
        aplicados.length > 0 && `Se ${aplicados.length === 1 ? 'vinculó' : 'vincularon'} ${aplicados.map(parVinculo).join(', ')}.`,
        omitidos.length > 0 &&
          `${omitidos.map((v) => `«${v.nombreInsumoProveedor}»`).join(', ')} ya ` +
            `${omitidos.length === 1 ? 'estaba vinculado' : 'estaban vinculados'} con ese insumo (lo hizo otra persona entre tanto): no se cambió.`,
      ].filter(Boolean)
      navigate('/facturas', {
        state: {
          mensaje: [`Factura N° ${datosCab.numero_factura} ${esNueva ? 'ingresada' : 'actualizada'}.`, textoPago, ...notas]
            .filter(Boolean)
            .join(' '),
        },
      })
    } catch (error) {
      const yaVinculados =
        resultadoVinculos?.aplicados.length > 0 ? ' Los vínculos aceptados sí quedaron guardados.' : ''
      setErrorGuardar(
        (error?.code === '23505'
          ? `Ya existe la factura N° ${datosCab.numero_factura} de este proveedor.`
          : mensajeError(error)) + yaVinculados,
      )
      // El catálogo refleja los vínculos ya aplicados (los avisos de stock y las
      // propuestas se actualizan solos).
      if (vinculos.length > 0) recargarCatalogo({ silencioso: true })
      setGuardando(false)
    }
  }

  const cancelar = () => {
    if (sucio && !window.confirm('Hay cambios sin guardar. ¿Salir sin guardarlos?')) return
    navigate('/facturas')
  }

  // Enter en un campo no envía la factura entera (se guarda con el botón).
  const evitarEnvioConEnter = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault()
  }

  if (carga !== 'lista') {
    return (
      <section className="mt-6">
        {carga === 'cargando' ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando factura…
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">
              {carga === 'no-encontrada'
                ? 'No se encontró la factura (puede que se haya eliminado).'
                : `No se pudo cargar la factura: ${mensajeError(errorCarga)}`}{' '}
              <Link to="/facturas" className="font-medium underline">
                Volver al listado
              </Link>
            </p>
          </div>
        )}
      </section>
    )
  }

  if (anulada) {
    return (
      <section className="mt-6">
        <button
          type="button"
          onClick={cancelar}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </button>
        <h2 className="mt-2 text-xl font-semibold text-slate-800">
          Factura N° {anulada.numero_factura} — {anulada.proveedor?.nombre ?? ''}
        </h2>
        <div className={`${claseTarjeta} mt-4 max-w-4xl`}>
          <DetalleFactura factura={anulada} onCerrar={cancelar} />
        </div>
      </section>
    )
  }

  const erroresCarga = [
    errorProveedores && `proveedores (${mensajeError(errorProveedores)})`,
    errorCatalogo && `catálogo (${mensajeError(errorCatalogo)})`,
    errorPendientes && `solicitudes pendientes (${mensajeError(errorPendientes)})`,
  ].filter(Boolean)

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={cancelar}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>
      <h2 className="mt-2 text-xl font-semibold text-slate-800">
        {esNueva ? 'Nueva factura' : `Editar factura N° ${numeroOriginal}`}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Ingresa las líneas tal como figuran en la factura física y, si aplica, los descuentos en %. Subtotales, neto, IVA
        y total se calculan solos. Las líneas con insumo vinculado a insumos Okima suman stock al guardar (cantidad ×
        factor de cada vínculo); al asociar una solicitud a un insumo sin ningún vínculo, se te pregunta si vincularlo
        con el insumo de la solicitud.
      </p>

      {erroresCarga.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          No se pudieron cargar: {erroresCarga.join(', ')}.
        </p>
      )}

      <form onSubmit={guardar} onKeyDown={evitarEnvioConEnter} noValidate className="mt-4 space-y-6">
        <div className={claseTarjeta}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cabecera</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              id="factura-proveedor"
              etiqueta="Proveedor"
              requerido
              error={errores.cabecera.id_proveedor}
              ayuda={'Si no existe, escríbelo y elige "Crear": pide nombre y RUT.'}
              className="sm:col-span-2"
            >
              <SelectorProveedorFactura
                id="factura-proveedor"
                valor={cabecera.id_proveedor}
                onChange={cambiarProveedor}
                proveedores={proveedores}
                onCrearProveedor={crearProveedor}
                cargando={cargandoProveedores}
                error={errorProveedores}
              />
            </Campo>
            <Campo id="factura-numero" etiqueta="N° factura" requerido error={errores.cabecera.numero_factura}>
              <input
                id="factura-numero"
                type="text"
                value={cabecera.numero_factura}
                onChange={(e) => cambiarCabecera('numero_factura', e.target.value)}
                className={`${claseInput}${errores.cabecera.numero_factura ? claseError : ''}`}
              />
            </Campo>
            <Campo id="factura-fecha" etiqueta="Fecha" requerido error={errores.cabecera.fecha}>
              <input
                id="factura-fecha"
                type="date"
                value={cabecera.fecha}
                onChange={(e) => cambiarCabecera('fecha', e.target.value)}
                className={`${claseInput}${errores.cabecera.fecha ? claseError : ''}`}
              />
            </Campo>
            <Campo
              id="factura-descuento"
              etiqueta="Descuento % de la factura"
              error={errores.cabecera.descuento_pct}
              ayuda="Opcional: descuento global sobre la suma de las líneas."
            >
              {/* 0 a 100: lo revisa erroresCabecera al guardar. */}
              <InputNumero
                id="factura-descuento"
                placeholder="0"
                valor={cabecera.descuento_pct}
                onChange={(valor) => cambiarCabecera('descuento_pct', valor)}
                className={`${claseInput}${errores.cabecera.descuento_pct ? claseError : ''}`}
              />
            </Campo>
            {esNueva && <SwitchPagoContado activo={alContado} onCambiar={setAlContado} />}
            <CampoNotas
              valor={cabecera.notas}
              onChange={(valor) => cambiarCabecera('notas', valor)}
              className="sm:col-span-2 lg:col-span-4"
            />
          </div>
        </div>

        <div className={`${claseTarjeta} bg-slate-50/60`}>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Líneas <span className="font-normal normal-case text-slate-400">({lineas.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {lineas.map((linea, i) => {
              const propuesta = vinculoPropuesto(linea, catalogoPorId, solicitudesPorId)
              return (
                <LineaFactura
                  key={linea.clave}
                  linea={linea}
                  numero={i + 1}
                  errores={errores.lineas[linea.clave]}
                  catalogo={catalogoProveedor}
                  itemCatalogo={catalogoPorId.get(linea.id_insumo_proveedor) ?? null}
                  idProveedor={cabecera.id_proveedor}
                  onCrearInsumo={crearInsumoProveedor}
                  cargandoCatalogo={cargandoCatalogo}
                  opcionesSolicitud={opcionesSolicitudPara(linea)}
                  cargandoSolicitudes={cargandoPendientes}
                  original={linea.id ? (originalesPorId.get(linea.id) ?? null) : null}
                  propuestaVinculo={propuesta}
                  vinculosPendientes={vinculosPendientesDe(linea.id_insumo_proveedor)}
                  onDecidirVinculo={(acepta) => decidirVinculoLinea(linea.clave, propuesta, acepta)}
                  onCambiar={(campo, valor) => cambiarLinea(linea.clave, campo, valor)}
                  onQuitar={() => quitarLinea(linea.clave)}
                  puedeQuitar={lineas.length > 1}
                />
              )
            })}
          </div>
          <button type="button" onClick={agregarLinea} className={`${claseBotonSecundario} mt-3`}>
            <Plus className="h-4 w-4" />
            Agregar línea
          </button>
        </div>

        <div className={claseTarjeta}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Totales de la factura (CLP)</h3>
          <dl className="ml-auto max-w-sm space-y-1.5 text-sm" aria-live="polite">
            <div className="flex justify-between gap-4 text-slate-600">
              <dt>Σ subtotales de las líneas</dt>
              <dd className="whitespace-nowrap">{formatoCLP(totales.sumaSubtotales)}</dd>
            </div>
            {totales.montoDescuento > 0 && (
              <div className="flex justify-between gap-4 text-slate-600">
                <dt>Descuento {formatoNumero(aNumero(cabecera.descuento_pct))} %</dt>
                <dd className="whitespace-nowrap">−{formatoCLP(totales.montoDescuento)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1.5 text-slate-700">
              <dt>Neto</dt>
              <dd className="whitespace-nowrap font-medium">{formatoCLP(totales.neto_total)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-slate-700">
              <dt>IVA 19 %</dt>
              <dd className="whitespace-nowrap font-medium">{formatoCLP(totales.iva)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-800">
              <dt>Total</dt>
              <dd className="whitespace-nowrap">{formatoCLP(totales.total)}</dd>
            </div>
          </dl>
        </div>

        {errorGuardar && (
          <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorGuardar}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={cancelar} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={claseBotonPrimario}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {esNueva ? 'Guardar factura' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default PaginaFactura
