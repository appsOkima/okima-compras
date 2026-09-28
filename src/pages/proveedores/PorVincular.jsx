import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, Link2, Loader2, Search, X } from 'lucide-react'
import Combobox from '../../components/Combobox'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonPrimario, claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoCompra } from '../../lib/formato'
import { coincide } from '../../lib/texto'

const SELECT = '*, proveedor:proveedores(id, nombre)'
const SELECT_INSUMOS = 'id, nombre, subcategoria:subcategorias(nombre)'

const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''

// Tiempo que queda visible la confirmación de un vínculo.
const DURACION_CONFIRMACION = 5000

// Lugar principal donde se vincula un insumo de proveedor con su insumo Okima
// (revisión semanal del administrador; también se puede, con confirmación, desde
// una línea de factura asociada a una solicitud). Se carga el catálogo completo y se
// filtra aquí: al vincular, `actualizar` deja la fila con id_insumo_okima y sale sola.
function PorVincular() {
  const { filas, cargando, error, actualizar } = useTabla('insumos_proveedores', { select: SELECT })
  const { filas: insumos, error: errorInsumos } = useTabla('insumos', { select: SELECT_INSUMOS })
  const [busqueda, setBusqueda] = useState('')
  // id del insumo de proveedor → id del insumo Okima elegido (aún sin guardar).
  const [seleccion, setSeleccion] = useState({})
  const [vinculando, setVinculando] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    if (!confirmacion) return
    const temporizador = setTimeout(() => setConfirmacion(''), DURACION_CONFIRMACION)
    return () => clearTimeout(temporizador)
  }, [confirmacion])

  const opcionesInsumos = useMemo(
    () => insumos.map((i) => ({ valor: i.id, etiqueta: i.nombre, detalle: i.subcategoria?.nombre })),
    [insumos],
  )

  const pendientes = useMemo(
    () =>
      filas.filter(
        (f) =>
          !f.id_insumo_okima &&
          (!busqueda || [f.nombre, f.codigo, nombreProveedor(f)].some((v) => coincide(v, busqueda))),
      ),
    [filas, busqueda],
  )

  const vincular = async (fila) => {
    const idInsumo = seleccion[fila.id]
    if (!idInsumo || vinculando) return
    setVinculando(fila.id)
    setErrorAccion('')
    try {
      await actualizar(fila.id, { id_insumo_okima: idInsumo })
      const insumo = insumos.find((i) => i.id === idInsumo)
      setConfirmacion(`"${fila.nombre}" quedó vinculado a "${insumo?.nombre ?? 'insumo Okima'}".`)
    } catch (e) {
      setErrorAccion(mensajeError(e))
    } finally {
      setVinculando(null)
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
      titulo: 'Insumo Okima',
      soloTabla: true,
      render: (fila) => (
        <div className="flex min-w-72 items-center gap-2 print:hidden">
          <Combobox
            className="flex-1"
            opciones={opcionesInsumos}
            valor={seleccion[fila.id] ?? ''}
            onChange={(valor) => setSeleccion((actual) => ({ ...actual, [fila.id]: valor }))}
            placeholder="Buscar insumo Okima…"
            etiqueta={`Insumo Okima para ${fila.nombre}`}
            disabled={vinculando === fila.id}
          />
          <button
            type="button"
            onClick={() => vincular(fila)}
            disabled={!seleccion[fila.id] || vinculando !== null}
            className={`${claseBotonPrimario} px-3`}
          >
            {vinculando === fila.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Vincular
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Insumos por vincular</h2>
        <p className="mt-1 text-sm text-slate-600">
          Insumos de proveedor sin insumo Okima asignado. Aquí se hace el vínculo, en la revisión semanal.
        </p>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Al vincular, las compras ya registradas no suman stock; solo las facturas que se ingresen desde ahora.
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
