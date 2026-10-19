import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { useAuth } from '../../auth/contexto'
import TablaDatos from '../../components/TablaDatos'
import { claseBotonSecundario, claseInput } from '../../components/estilos'
import { useTabla } from '../../hooks/useTabla'
import { useBusquedaPersistente } from '../../hooks/useBusquedaPersistente'
import { mensajeError } from '../../lib/errores'
import { formatoCLP } from '../../lib/formato'
import { puedeHacer } from '../../lib/permisos'
import { coincide } from '../../lib/texto'
import { esDescartado } from '../../lib/vinculos'

const SELECT = '*, proveedor:proveedores(id, nombre), vinculos:insumos_proveedores_okima(id)'
const DURACION_CONFIRMACION = 5000

const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''

// Insumos de proveedor descartados en "Por vincular" (se_vincula = false): nunca se
// vincularán a un insumo Okima. "Restaurar" los devuelve a esa lista (si no tienen
// vínculos) y a las propuestas de vínculo de las facturas.
function SinVinculo() {
  const { perfil } = useAuth()
  const puedeRestaurar = puedeHacer(perfil?.rol, 'catalogo', 'editar')
  const { filas, cargando, error, actualizar } = useTabla('insumos_proveedores', { select: SELECT })
  const [busqueda, setBusqueda] = useBusquedaPersistente()
  const [restaurando, setRestaurando] = useState(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [confirmacion, setConfirmacion] = useState('')

  useEffect(() => {
    if (!confirmacion) return
    const temporizador = setTimeout(() => setConfirmacion(''), DURACION_CONFIRMACION)
    return () => clearTimeout(temporizador)
  }, [confirmacion])

  const descartados = useMemo(
    () =>
      filas.filter(
        (f) => esDescartado(f) && (!busqueda || [f.nombre, f.codigo, nombreProveedor(f)].some((v) => coincide(v, busqueda))),
      ),
    [filas, busqueda],
  )

  // Un UPDATE denegado por el RLS lo reporta useTabla.actualizar (single() sin fila).
  const restaurar = async (fila) => {
    if (restaurando) return
    setRestaurando(fila.id)
    setErrorAccion('')
    try {
      await actualizar(fila.id, { se_vincula: true })
      setConfirmacion(`"${fila.nombre}" se restauró.`)
    } catch (e) {
      setErrorAccion(mensajeError(e))
    } finally {
      setRestaurando(null)
    }
  }

  const columnas = [
    { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'codigo', titulo: 'Código' },
    {
      clave: 'precio_clp',
      titulo: 'Precio',
      alinear: 'derecha',
      render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.precio_clp)}</span>,
    },
    ...(puedeRestaurar
      ? [
          {
            clave: 'restaurar',
            titulo: 'Acciones',
            soloTabla: true,
            render: (fila) => (
              <button
                type="button"
                onClick={() => restaurar(fila)}
                disabled={restaurando !== null}
                className={`${claseBotonSecundario} px-3 print:hidden`}
              >
                {restaurando === fila.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Restaurar
              </button>
            ),
          },
        ]
      : []),
  ]

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Sin vínculo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Insumos de proveedor descartados: nunca se vincularán a un insumo Okima. No aparecen en Por vincular ni se
          propone vincularlos al ingresar facturas. Restaura uno si cambia de idea.
        </p>
      </div>

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
          filas={descartados}
          nombreArchivo="insumos-sin-vinculo"
          cargando={cargando}
          error={error}
          vacio={busqueda ? 'Ningún registro coincide con los filtros.' : 'No hay insumos descartados.'}
          barra={
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar en insumos sin vínculo"
                className={`${claseInput} pl-9`}
              />
            </div>
          }
        />
      </div>
    </section>
  )
}

export default SinVinculo
