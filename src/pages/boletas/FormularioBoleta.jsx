import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertCircle, AlertTriangle, ArrowLeft, Loader2, Plus, Save } from 'lucide-react'
import CampoNotas from '../../components/CampoNotas'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'
import { claseBotonAdvertencia, claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { useConfirmarSalida } from '../../hooks/useConfirmarSalida'
import { useTabla } from '../../hooks/useTabla'
import {
  datosBoleta,
  datosLineaBoleta,
  diffLineasBoleta,
  erroresBoleta,
  erroresLineaBoleta,
  lineaBoletaDesdeBase,
  lineaBoletaVacia,
  totalBoleta,
  valoresDesdePlantilla,
} from '../../lib/boletas'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha } from '../../lib/formato'
import { etiquetaMes, gastosDePlantillaEnMes, mesDe } from '../../lib/gastos'
import { numeroAEditable } from '../../lib/numero'
import { hoyISO } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import Campo from '../facturas/Campo'
import LineaBoleta from './LineaBoleta'
import SelectorProveedor from './SelectorProveedor'

const SELECT_PLANTILLAS = 'id, nombre, id_subcategoria, monto_default'
const SELECT_PROVEEDORES = 'id, nombre, rut'
// Catálogo de todos los proveedores (el proveedor de la boleta es opcional); el
// nombre del proveedor distingue insumos homónimos en el selector.
const SELECT_CATALOGO =
  'id, nombre, codigo, id_proveedor, cantidad_formato, formato_unidad, proveedor:proveedores(nombre), vinculos:insumos_proveedores_okima(id_insumo_okima, factor_conversion, insumo:insumos(id, nombre))'
const SELECT_BOLETA =
  'id, concepto, id_subcategoria, id_proveedor, fecha, numero_documento, notas, monto, ' +
  'lineas:detalle_boletas(id, created_at, descripcion, id_insumo_proveedor, cantidad, precio, subtotal)'

const claseTarjeta = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
const claseError = ' border-red-400 focus:border-red-500 focus:ring-red-500/30'

const etiquetaBoleta = (g) => `${g.concepto} — ${formatoFecha(g.fecha)} — ${formatoCLP(g.monto)}`

function cabeceraVacia() {
  return { concepto: '', id_subcategoria: '', id_proveedor: '', fecha: hoyISO(), numero_documento: '', notas: '' }
}

// /boletas/nuevo y /boletas/:id. La key reinicia el formulario si cambia la ruta o
// la plantilla del ingreso rápido.
function PaginaBoleta() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const idPlantilla = id ? null : parametros.get('plantilla')
  return <FormularioBoleta key={`${id ?? 'nueva'}|${idPlantilla ?? ''}`} id={id ?? null} idPlantilla={idPlantilla} />
}

// Formulario maestro-detalle de una boleta (página completa, no modal), como el de
// Facturas: cabecera y líneas (descripción, insumo del proveedor opcional,
// cantidad y precio). Subtotales y total se calculan en vivo y el total se guarda
// en boletas.monto. El stock de las líneas con insumo vinculado lo mueve la base.
// Guardado sin RPC (el cliente de Supabase no hace transacciones de varias
// sentencias): cabecera y luego líneas.
// Ingreso rápido de gasto recurrente: /boletas/nuevo?plantilla=<id> (desde los
// atajos del listado, ver IngresoRapido) pre-llena concepto, subcategoría y UNA
// línea (descripción = nombre de la plantilla, cantidad 1, precio = monto por
// defecto), guarda `id_plantilla_recurrente` y avisa si esa plantilla ya tiene
// boleta en el mes de la fecha elegida. Si la plantilla no existe se muestra el
// error con el enlace al listado (no una boleta en blanco, que perdería el vínculo
// con la plantilla sin que se note). Al editar se ignora la plantilla.
function FormularioBoleta({ id, idPlantilla }) {
  const navigate = useNavigate()
  const esNueva = id === null

  const {
    filas: proveedores,
    cargando: cargandoProveedores,
    error: errorProveedores,
  } = useTabla('proveedores', { select: SELECT_PROVEEDORES })
  const {
    filas: catalogo,
    cargando: cargandoCatalogo,
    error: errorCatalogo,
    crear: crearInsumoProveedor,
  } = useTabla('insumos_proveedores', { select: SELECT_CATALOGO })
  // Tabla corta: se cargan todas y se busca la pedida (incluye las inactivas).
  const {
    filas: plantillas,
    cargando: cargandoPlantillas,
    error: errorPlantillas,
  } = useTabla('plantillas_gastos_recurrentes', { select: SELECT_PLANTILLAS })

  const plantilla = idPlantilla ? (plantillas.find((p) => p.id === idPlantilla) ?? null) : null

  const siguienteClave = useRef(0)
  const nuevaClave = () => `nueva-${++siguienteClave.current}`

  // 'cargando' | 'lista' | 'no-encontrada' | 'error'
  const [carga, setCarga] = useState(esNueva ? 'lista' : 'cargando')
  const [errorCarga, setErrorCarga] = useState(null)
  const [conceptoOriginal, setConceptoOriginal] = useState('')
  const [cabecera, setCabecera] = useState(cabeceraVacia)
  const [lineas, setLineas] = useState(() => [lineaBoletaVacia('nueva-0')])
  // Líneas tal como están guardadas: base del diff al editar.
  const [originales, setOriginales] = useState([])
  const [sucio, setSucio] = useState(false)
  const [errores, setErrores] = useState({ cabecera: {}, lineas: {} })
  const [errorGuardar, setErrorGuardar] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Boletas ya registradas de esta plantilla (para el aviso del mes) y las del
  // mes de la fecha elegida que se mostraron en el aviso (se vuelve a chequear al guardar).
  const [deLaPlantilla, setDeLaPlantilla] = useState([])
  const [duplicados, setDuplicados] = useState([])
  const permitirSalida = useConfirmarSalida(sucio)

  // Ingreso rápido: se pre-llena una sola vez, cuando carga la plantilla.
  const plantillaAplicada = useRef(false)
  useEffect(() => {
    if (!plantilla || plantillaAplicada.current) return
    plantillaAplicada.current = true
    const valores = valoresDesdePlantilla(plantilla, nuevaClave())
    setCabecera((actual) => ({ ...actual, ...valores.cabecera }))
    setLineas(valores.lineas)
  }, [plantilla])

  useEffect(() => {
    if (!idPlantilla) return
    let vigente = true
    supabase
      .from('boletas')
      .select('id, concepto, fecha, monto, id_plantilla_recurrente')
      .eq('id_plantilla_recurrente', idPlantilla)
      .then(({ data }) => {
        if (vigente) setDeLaPlantilla(data ?? [])
      })
    return () => {
      vigente = false
    }
  }, [idPlantilla])

  useEffect(() => {
    if (esNueva) return
    let vigente = true
    supabase
      .from('boletas')
      .select(SELECT_BOLETA)
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
        const guardadas = [...(data.lineas ?? [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        setCabecera({
          concepto: data.concepto,
          id_subcategoria: data.id_subcategoria ?? '',
          id_proveedor: data.id_proveedor ?? '',
          fecha: data.fecha,
          numero_documento: data.numero_documento ?? '',
          notas: data.notas ?? '',
        })
        setOriginales(guardadas)
        // Boleta sin líneas (anterior a las líneas): una línea con su concepto y monto.
        setLineas(
          guardadas.length > 0
            ? guardadas.map(lineaBoletaDesdeBase)
            : [
                {
                  ...lineaBoletaVacia(nuevaClave()),
                  descripcion: data.concepto,
                  precio: Number(data.monto) > 0 ? numeroAEditable(data.monto) : '',
                },
              ],
        )
        setConceptoOriginal(data.concepto)
        setCarga('lista')
      })
    return () => {
      vigente = false
    }
  }, [esNueva, id])

  const opcionesProveedores = useMemo(
    () => proveedores.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.rut })),
    [proveedores],
  )
  const catalogoPorId = useMemo(() => new Map(catalogo.map((item) => [item.id, item])), [catalogo])
  // Con proveedor, solo su catálogo; sin proveedor, todo (y no se puede crear insumo).
  const catalogoDisponible = useMemo(
    () => (cabecera.id_proveedor ? catalogo.filter((item) => item.id_proveedor === cabecera.id_proveedor) : catalogo),
    [catalogo, cabecera.id_proveedor],
  )

  // Total en vivo: es el mismo que se guarda en boletas.monto (ver datosBoleta).
  const total = totalBoleta(lineas)

  const limpiarError = (grupo, clave, campo) =>
    setErrores((actuales) =>
      grupo === 'cabecera'
        ? { ...actuales, cabecera: { ...actuales.cabecera, [campo]: undefined } }
        : { ...actuales, lineas: { ...actuales.lineas, [clave]: { ...actuales.lineas[clave], [campo]: undefined } } },
    )

  // Cualquier cambio invalida el aviso de plantilla duplicada: se vuelve a chequear al guardar.
  const marcarSucio = () => {
    setSucio(true)
    setDuplicados([])
  }

  const cambiarCabecera = (campo, valor) => {
    setCabecera((actual) => ({ ...actual, [campo]: valor }))
    limpiarError('cabecera', null, campo)
    marcarSucio()
  }

  // Los insumos de las líneas son del catálogo del proveedor elegido: al cambiarlo
  // se confirma y se quitan los de otro proveedor. Sin proveedor no se filtra nada.
  const cambiarProveedor = (nuevoId) => {
    if (nuevoId) {
      const ajenas = lineas.filter((l) => {
        const item = catalogoPorId.get(l.id_insumo_proveedor)
        return item && item.id_proveedor !== nuevoId
      })
      if (ajenas.length > 0) {
        const n = ajenas.length
        const confirmado = window.confirm(
          `${n === 1 ? 'Hay 1 línea' : `Hay ${n} líneas`} con insumos de otro proveedor. ` +
            'Al cambiar el proveedor se quita el insumo de esas líneas (descripciones, cantidades y precios se conservan). ¿Continuar?',
        )
        if (!confirmado) return
        const claves = new Set(ajenas.map((l) => l.clave))
        setLineas((actuales) => actuales.map((l) => (claves.has(l.clave) ? { ...l, id_insumo_proveedor: '' } : l)))
      }
    }
    cambiarCabecera('id_proveedor', nuevoId)
  }

  const cambiarLinea = (clave, campo, valor) => {
    setLineas((actuales) => actuales.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)))
    limpiarError('lineas', clave, campo)
    marcarSucio()
  }

  const agregarLinea = () => {
    setLineas((actuales) => [...actuales, lineaBoletaVacia(nuevaClave())])
    marcarSucio()
  }

  const quitarLinea = (clave) => {
    setLineas((actuales) => actuales.filter((l) => l.clave !== clave))
    marcarSucio()
  }

  // Nueva: cabecera y luego todas las líneas en un solo insert (todas o ninguna).
  // Si fallan las líneas se borra la cabecera para no dejar una boleta vacía.
  const crearBoleta = async (datosCab, datosLineas) => {
    const cabeceraNueva = plantilla ? { ...datosCab, id_plantilla_recurrente: plantilla.id } : datosCab
    const { data, error } = await supabase.from('boletas').insert(cabeceraNueva).select('id').single()
    if (error) throw error
    const { error: errorLineas } = await supabase
      .from('detalle_boletas')
      .insert(datosLineas.map((l) => ({ ...l, id_boleta: data.id })))
    if (!errorLineas) return
    const { error: errorBorrar } = await supabase.from('boletas').delete().eq('id', data.id)
    if (errorBorrar) {
      throw new Error(
        `No se pudieron guardar las líneas (${mensajeError(errorLineas)}) y la boleta quedó sin líneas: ` +
          'edítala o bórrala desde el listado.',
      )
    }
    throw errorLineas
  }

  // Edición: cabecera y luego el diff de líneas (borrar, actualizar, insertar). No
  // se envía id_plantilla_recurrente, así que se conserva. Si algo falla a medio
  // camino, lo ya aplicado pasa a ser la base del diff para que volver a guardar
  // no duplique ni repita cambios.
  const actualizarBoleta = async (datosCab, datosLineas) => {
    const { error } = await supabase.from('boletas').update(datosCab).eq('id', id)
    if (error) throw error
    const { eliminar, actualizar, insertar } = diffLineasBoleta(originales, datosLineas)
    let vigentes = originales
    try {
      if (eliminar.length > 0) {
        const { error: errorEliminar } = await supabase.from('detalle_boletas').delete().in('id', eliminar)
        if (errorEliminar) throw errorEliminar
        vigentes = vigentes.filter((o) => !eliminar.includes(o.id))
      }
      for (const { id: idLinea, datos } of actualizar) {
        const { error: errorActualizar } = await supabase.from('detalle_boletas').update(datos).eq('id', idLinea)
        if (errorActualizar) throw errorActualizar
        vigentes = vigentes.map((o) => (o.id === idLinea ? { ...o, ...datos } : o))
      }
      if (insertar.length > 0) {
        const { error: errorInsertar } = await supabase
          .from('detalle_boletas')
          .insert(insertar.map((l) => ({ ...l, id_boleta: id })))
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

    const datosCab = datosBoleta(cabecera, lineas)
    const erroresCab = erroresBoleta(datosCab)
    const datosLineas = lineas.map(datosLineaBoleta)
    const erroresLineas = {}
    lineas.forEach((l, i) => {
      const errLinea = erroresLineaBoleta(datosLineas[i])
      if (Object.keys(errLinea).length > 0) erroresLineas[l.clave] = errLinea
    })
    setErrores({ cabecera: erroresCab, lineas: erroresLineas })
    if (lineas.length === 0) {
      setErrorGuardar('Agrega al menos una línea.')
      return
    }
    if (Object.keys(erroresCab).length > 0 || Object.keys(erroresLineas).length > 0) {
      setErrorGuardar('Revisa los campos marcados.')
      return
    }

    // Primer clic: avisa si esta plantilla ya tiene boleta en el mes de la fecha
    // elegida; el segundo ("Guardar de todos modos") guarda.
    if (plantilla && duplicados.length === 0) {
      const encontrados = gastosDePlantillaEnMes(deLaPlantilla, plantilla.id, datosCab.fecha)
      if (encontrados.length > 0) {
        setDuplicados(encontrados)
        setErrorGuardar('')
        return
      }
    }

    setErrorGuardar('')
    setGuardando(true)
    try {
      if (esNueva) await crearBoleta(datosCab, datosLineas)
      else await actualizarBoleta(datosCab, datosLineas)
      // Ya se guardó: la vuelta al listado no pide confirmación.
      permitirSalida()
      navigate('/boletas', {
        state: { mensaje: `Boleta «${datosCab.concepto}» ${esNueva ? 'creada' : 'actualizada'}.` },
      })
    } catch (error) {
      setErrorGuardar(mensajeError(error))
      setGuardando(false)
    }
  }

  // Si hay cambios sin guardar, el bloqueo de useConfirmarSalida pregunta antes.
  const volver = () => navigate('/boletas')

  // Enter en un campo no envía la boleta entera (se guarda con el botón).
  const evitarEnvioConEnter = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault()
  }

  // Con plantilla, la página espera a tenerla; si falta se muestra el error.
  let errorPlantilla
  if (idPlantilla && !cargandoPlantillas) {
    if (errorPlantillas) errorPlantilla = `No se pudo cargar la plantilla: ${mensajeError(errorPlantillas)}`
    else if (!plantilla) errorPlantilla = 'No se encontró la plantilla de gasto recurrente (puede que se haya eliminado).'
  }
  const esperandoPlantilla = Boolean(idPlantilla) && cargandoPlantillas

  if (carga !== 'lista' || esperandoPlantilla || errorPlantilla) {
    return (
      <section className="mt-6">
        {carga === 'cargando' || esperandoPlantilla ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">
              {errorPlantilla ??
                (carga === 'no-encontrada'
                  ? 'No se encontró la boleta (puede que se haya eliminado).'
                  : `No se pudo cargar la boleta: ${mensajeError(errorCarga)}`)}{' '}
              <Link to="/boletas" className="font-medium underline">
                Volver al listado
              </Link>
            </p>
          </div>
        )}
      </section>
    )
  }

  const erroresCarga = [
    errorProveedores && `proveedores (${mensajeError(errorProveedores)})`,
    errorCatalogo && `catálogo (${mensajeError(errorCatalogo)})`,
  ].filter(Boolean)

  const titulo = esNueva
    ? plantilla
      ? `Registrar boleta: ${plantilla.nombre}`
      : 'Nueva boleta'
    : `Editar: ${conceptoOriginal}`

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={volver}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>
      <h2 className="mt-2 text-xl font-semibold text-slate-800">{titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {plantilla
          ? 'Pre-llenado desde la plantilla recurrente: revisa el precio y confirma la fecha. '
          : 'Ingresa las líneas de la boleta; el subtotal de cada una y el total se calculan solos. '}
        Si una línea tiene un insumo del proveedor vinculado a insumos Okima, suma stock al guardar.
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
            <Campo id="boleta-concepto" etiqueta="Concepto" requerido error={errores.cabecera.concepto} className="sm:col-span-2">
              <input
                id="boleta-concepto"
                type="text"
                value={cabecera.concepto}
                onChange={(e) => cambiarCabecera('concepto', e.target.value)}
                className={`${claseInput}${errores.cabecera.concepto ? claseError : ''}`}
              />
            </Campo>
            <Campo
              id="boleta-fecha"
              etiqueta="Fecha"
              requerido
              error={errores.cabecera.fecha}
              ayuda="Por defecto hoy; se puede registrar una boleta de una fecha pasada."
            >
              <input
                id="boleta-fecha"
                type="date"
                value={cabecera.fecha}
                onChange={(e) => cambiarCabecera('fecha', e.target.value)}
                className={`${claseInput}${errores.cabecera.fecha ? claseError : ''}`}
              />
            </Campo>
            <Campo id="boleta-numero" etiqueta="N° documento">
              <input
                id="boleta-numero"
                type="text"
                value={cabecera.numero_documento}
                onChange={(e) => cambiarCabecera('numero_documento', e.target.value)}
                className={claseInput}
              />
            </Campo>
            <Campo id="boleta-subcategoria" etiqueta="Subcategoría (centro de costo)" className="sm:col-span-2">
              <SelectorSubcategoria
                id="boleta-subcategoria"
                valor={cabecera.id_subcategoria}
                onChange={(valor) => cambiarCabecera('id_subcategoria', valor)}
              />
            </Campo>
            <Campo id="boleta-proveedor" etiqueta="Proveedor" className="sm:col-span-2">
              <SelectorProveedor
                id="boleta-proveedor"
                valor={cabecera.id_proveedor}
                onChange={cambiarProveedor}
                opciones={opcionesProveedores}
                cargando={cargandoProveedores}
                error={errorProveedores}
              />
            </Campo>
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
            {lineas.map((linea, i) => (
              <LineaBoleta
                key={linea.clave}
                linea={linea}
                numero={i + 1}
                errores={errores.lineas[linea.clave]}
                catalogo={catalogoDisponible}
                idProveedor={cabecera.id_proveedor}
                onCrearInsumo={crearInsumoProveedor}
                cargandoCatalogo={cargandoCatalogo}
                onCambiar={(campo, valor) => cambiarLinea(linea.clave, campo, valor)}
                onQuitar={() => quitarLinea(linea.clave)}
                puedeQuitar={lineas.length > 1}
              />
            ))}
          </div>
          <button type="button" onClick={agregarLinea} className={`${claseBotonSecundario} mt-3`}>
            <Plus className="h-4 w-4" />
            Agregar línea
          </button>
        </div>

        <div className={claseTarjeta}>
          <dl className="ml-auto max-w-sm text-sm" aria-live="polite">
            <div className="flex justify-between gap-4 text-base font-semibold text-slate-800">
              <dt>Total de la boleta (CLP)</dt>
              <dd className="whitespace-nowrap">{formatoCLP(total)}</dd>
            </div>
          </dl>
        </div>

        {duplicados.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Ya registraste {plantilla.nombre} en {etiquetaMes(mesDe(duplicados[0]?.fecha))}:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-10">
              {duplicados.slice(0, 5).map((r) => (
                <li key={r.id}>{etiquetaBoleta(r)}</li>
              ))}
              {duplicados.length > 5 && <li>y {duplicados.length - 5} más…</li>}
            </ul>
          </div>
        )}

        {errorGuardar && (
          <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorGuardar}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={volver} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className={duplicados.length > 0 ? claseBotonAdvertencia : claseBotonPrimario}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {duplicados.length > 0 ? 'Guardar de todos modos' : esNueva ? 'Guardar boleta' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default PaginaBoleta
