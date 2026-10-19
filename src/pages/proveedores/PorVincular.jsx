import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Ban, CheckCircle2, Info, Link2, Loader2, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/contexto'
import ComboboxInsumoOkima from '../../components/ComboboxInsumoOkima'
import InputNumero from '../../components/InputNumero'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { useBusquedaPersistente } from '../../hooks/useBusquedaPersistente'
import { mensajeError } from '../../lib/errores'
import { puedeHacer } from '../../lib/permisos'
import { formatoCLP, formatoCompra } from '../../lib/formato'
import { aNumeroDesdeTexto, numeroAEditable } from '../../lib/numero'
import { supabase } from '../../lib/supabase'
import { coincide } from '../../lib/texto'
import { AYUDA_FACTOR, esPendienteDeVincular, factorPorDefecto, validarFactor } from '../../lib/vinculos'

// vinculos: solo para saber si el insumo ya tiene alguna fila en la pivote.
// se_vincula = false (descartados) no se listan aquí: están en "Sin vínculo".
const SELECT = '*, proveedor:proveedores(id, nombre), vinculos:insumos_proveedores_okima(id)'
const SELECT_INSUMOS = 'id, nombre, subcategoria:subcategorias(nombre)'

const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''

// Tiempo que queda visible la confirmación de un vínculo.
const DURACION_CONFIRMACION = 5000

// Lugar principal donde se vincula un insumo de proveedor con su insumo Okima
// (revisión semanal del administrador; también se puede, con confirmación, desde
// una línea de factura asociada a una solicitud). Se carga el catálogo completo y se
// filtra aquí: los que no tienen ninguna fila en la pivote. Al vincular se inserta
// la fila (insumo Okima + factor de conversión) y se recarga: el insumo sale solo.
// Para vincularlo a más de un insumo Okima, se edita en el Catálogo.
function PorVincular() {
  const { perfil } = useAuth()
  const puedeDescartar = puedeHacer(perfil?.rol, 'catalogo', 'editar')
  const { filas, cargando, error, recargar, actualizar } = useTabla('insumos_proveedores', { select: SELECT })
  const { filas: insumos, error: errorInsumos, crear: crearInsumo } = useTabla('insumos', { select: SELECT_INSUMOS })
  const [busqueda, setBusqueda] = useBusquedaPersistente()
  // id del insumo de proveedor → id del insumo Okima elegido (aún sin guardar).
  const [seleccion, setSeleccion] = useState({})
  // id del insumo de proveedor → factor escrito (si no, el por defecto de la fila).
  const [factores, setFactores] = useState({})
  const [vinculando, setVinculando] = useState(null)
  const [descartando, setDescartando] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    if (!confirmacion) return
    const temporizador = setTimeout(() => setConfirmacion(''), DURACION_CONFIRMACION)
    return () => clearTimeout(temporizador)
  }, [confirmacion])

  const pendientes = useMemo(
    () =>
      filas.filter(
        (f) =>
          esPendienteDeVincular(f) &&
          (!busqueda || [f.nombre, f.codigo, nombreProveedor(f)].some((v) => coincide(v, busqueda))),
      ),
    [filas, busqueda],
  )

  // Factor de la fila como texto de input: el escrito o, si no, cantidad por
  // formato (si es > 0) o 1.
  const factorDe = (fila) => factores[fila.id] ?? numeroAEditable(factorPorDefecto(fila.cantidad_formato))

  const vincular = async (fila) => {
    const idInsumo = seleccion[fila.id]
    if (!idInsumo || vinculando) return
    setVinculando(fila.id)
    setErrorAccion('')
    try {
      const errorFactor = validarFactor(factorDe(fila))
      if (errorFactor) throw new Error(errorFactor)
      const { error: errorVincular } = await supabase.from('insumos_proveedores_okima').insert({
        id_insumo_proveedor: fila.id,
        id_insumo_okima: idInsumo,
        factor_conversion: aNumeroDesdeTexto(factorDe(fila)),
      })
      if (errorVincular) throw errorVincular
      await recargar({ silencioso: true })
      const insumo = insumos.find((i) => i.id === idInsumo)
      setConfirmacion(`"${fila.nombre}" quedó vinculado a "${insumo?.nombre ?? 'insumo Okima'}".`)
    } catch (e) {
      setErrorAccion(mensajeError(e))
    } finally {
      setVinculando(null)
    }
  }

  // Marca el insumo como "no se vincula": sale de esta lista y la factura deja de proponer
  // vincularlo. Reversible desde "Sin vínculo". Un UPDATE denegado por el RLS lo reporta
  // useTabla.actualizar (update().select().single() sin fila → mensajeError lo traduce).
  const descartar = async (fila) => {
    if (descartando || vinculando) return
    if (!window.confirm(`¿Descartar "${fila.nombre}"? No se vinculará a ningún insumo Okima y saldrá de esta lista. Puedes restaurarlo en "Sin vínculo".`)) return
    setDescartando(fila.id)
    setErrorAccion('')
    try {
      await actualizar(fila.id, { se_vincula: false })
      setConfirmacion(`"${fila.nombre}" se descartó; búscalo en "Sin vínculo" si necesitas restaurarlo.`)
    } catch (e) {
      setErrorAccion(mensajeError(e))
    } finally {
      setDescartando(null)
    }
  }

  const columnas = [
    { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'codigo', titulo: 'Código' },
    {
      clave: 'formato',
      titulo: 'Formato',
      soloTabla: true,
      render: (fila) => formatoCompra(fila.cantidad_formato, fila.formato_unidad),
    },
    { clave: 'formato_unidad', titulo: 'Formato unidad', soloCsv: true },
    { clave: 'cantidad_formato', titulo: 'Cantidad por formato', soloCsv: true },
    {
      clave: 'precio_clp',
      titulo: 'Precio',
      alinear: 'derecha',
      render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.precio_clp)}</span>,
    },
    {
      clave: 'vincular',
      titulo: 'Insumo Okima y factor',
      soloTabla: true,
      render: (fila) => (
        <div className="flex min-w-96 items-center gap-2 print:hidden">
          <ComboboxInsumoOkima
            className="min-w-0 flex-1"
            insumos={insumos}
            valor={seleccion[fila.id] ?? ''}
            onChange={(valor) => setSeleccion((actual) => ({ ...actual, [fila.id]: valor }))}
            onCrearInsumo={crearInsumo}
            sugerido={fila.nombre}
            placeholder="Buscar o crear insumo Okima…"
            etiqueta={`Insumo Okima para ${fila.nombre}`}
            disabled={vinculando === fila.id}
          />
          <label className="flex items-center gap-1 text-sm text-slate-600">
            ×
            <InputNumero
              className={`${claseInput} w-24`}
              valor={factorDe(fila)}
              onChange={(valor) => setFactores((actual) => ({ ...actual, [fila.id]: valor }))}
              aria-label={`Factor de conversión de ${fila.nombre}`}
              disabled={vinculando === fila.id}
            />
          </label>
          <button
            type="button"
            onClick={() => vincular(fila)}
            disabled={!seleccion[fila.id] || vinculando !== null}
            className={`${claseBotonPrimario} px-3`}
          >
            {vinculando === fila.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular
          </button>
          {puedeDescartar && (
            <button
              type="button"
              onClick={() => descartar(fila)}
              disabled={vinculando !== null || descartando !== null}
              className={`${claseBotonSecundario} px-3`}
              title="Este insumo nunca se vinculará a un insumo Okima"
            >
              {descartando === fila.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Descartar
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Insumos por vincular</h2>
        <p className="mt-1 text-sm text-slate-600">
          Insumos de proveedor sin ningún insumo Okima asignado. Aquí se hace el vínculo, en la revisión semanal. Para
          vincular uno a más de un insumo Okima, edítalo en el Catálogo. Los que nunca se vincularán se pueden descartar.
        </p>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Al vincular, las compras ya registradas no suman stock; solo las facturas que se ingresen desde ahora.{' '}
          {AYUDA_FACTOR} Por defecto se propone la cantidad por formato del insumo (o 1); puedes cambiarla.
        </span>
      </p>

      {errorInsumos && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          No se pudieron cargar los insumos Okima: {mensajeError(errorInsumos)}
        </p>
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

      {confirmacion && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{confirmacion}</p>
          <button
            type="button"
            onClick={() => setConfirmacion('')}
            aria-label="Cerrar aviso"
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4">
        <TablaDatos
          columnas={columnas}
          filas={pendientes}
          nombreArchivo="insumos-por-vincular"
          cargando={cargando}
          error={error}
          vacio={busqueda ? 'Ningún registro coincide con los filtros.' : 'No hay insumos por vincular.'}
          barra={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en insumos por vincular"
                className={`${claseInput} pl-9`}
              />
            </div>
          }
        />
      </div>
    </section>
  )
}

export default PorVincular
