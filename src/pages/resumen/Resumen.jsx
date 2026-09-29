import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import FiltroMes from '../../components/FiltroMes'
import TablaDatos from '../../components/TablaDatos'
import { claseInput } from '../../components/estilos'
import { formatoCLP } from '../../lib/formato'
import { etiquetaMes } from '../../lib/gastos'
import {
  ETIQUETA_SIN_CENTRO,
  SIN_CENTRO,
  indiceSubcategorias,
  mesesDeMovimientos,
  movimientos,
  resumenPorCentro,
  resumenPorMes,
  totales,
} from '../../lib/resumen'
import { supabase } from '../../lib/supabase'

// De cada factura, su total (con IVA) y el subtotal de sus líneas con la
// subcategoría del insumo Okima vinculado al insumo del proveedor (ver lib/resumen).
const SELECT_FACTURAS =
  'id, fecha, total, lineas:detalle_facturas(subtotal, insumo_proveedor:insumos_proveedores(insumo:insumos(id_subcategoria)))'
const SELECT_GASTOS = 'id, fecha, monto, id_subcategoria'
// Todas, también las inactivas: el historial puede usarlas.
const SELECT_SUBCATEGORIAS = 'id, nombre, activo, categoria:categorias(id, nombre, activo)'

// Supabase entrega a lo más 1000 filas por consulta (max_rows por defecto): se
// pide por páginas para que el resumen no quede corto cuando haya más registros.
const TAMANO_PAGINA = 1000

async function cargarTodo(tabla, select) {
  const filas = []
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(select)
      .order('id')
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < TAMANO_PAGINA) return filas
  }
}

// Carga única de las tres tablas (solo lectura: no hay que recargar tras editar).
function useDatosResumen() {
  const [datos, setDatos] = useState({ facturas: [], gastos: [], subcategorias: [], cargando: true, error: null })

  useEffect(() => {
    let vigente = true
    Promise.all([
      cargarTodo('facturas', SELECT_FACTURAS),
      cargarTodo('otros_gastos', SELECT_GASTOS),
      cargarTodo('subcategorias', SELECT_SUBCATEGORIAS),
    ])
      .then(([facturas, gastos, subcategorias]) => {
        if (vigente) setDatos({ facturas, gastos, subcategorias, cargando: false, error: null })
      })
      .catch((error) => {
        if (vigente) setDatos((d) => ({ ...d, cargando: false, error }))
      })
    return () => {
      vigente = false
    }
  }, [])

  return datos
}

const comparar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })

const porcentaje = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Montos en pantalla con formato CLP; en el CSV, el número redondeado al peso.
const columnaMonto = (clave, titulo) => ({
  clave,
  titulo,
  alinear: 'derecha',
  render: (f) => <span className="whitespace-nowrap">{formatoCLP(f[clave])}</span>,
  csv: (f) => Math.round(f[clave]),
})

const columnasMes = [
  {
    clave: 'mes',
    titulo: 'Mes',
    render: (f) => <span className="whitespace-nowrap">{f.mes ? etiquetaMes(f.mes) : 'Sin fecha'}</span>,
    // 'YYYY-MM': ordena bien y Excel no lo confunde.
    csv: (f) => f.mes ?? '',
  },
  columnaMonto('facturas', 'Facturas'),
  columnaMonto('otrosGastos', 'Otros gastos'),
  columnaMonto('total', 'Total'),
]

const columnasCentro = [
  { clave: 'categoria', titulo: 'Centro de costo' },
  {
    clave: 'subcategoria',
    titulo: 'Subcategoría',
    render: (f) => f.subcategoria || <span className="text-slate-400">—</span>,
  },
  columnaMonto('facturas', 'Facturas'),
  columnaMonto('otrosGastos', 'Otros gastos'),
  columnaMonto('total', 'Total'),
  {
    clave: 'pct',
    titulo: '% del total',
    alinear: 'derecha',
    render: (f) => <span className="whitespace-nowrap">{porcentaje.format(f.pct)} %</span>,
    csv: (f) => Math.round(f.pct * 10) / 10,
  },
]

// Línea bajo cada tabla, como el total de los listados de Facturas y Gastos.
function LineaTotal({ filas }) {
  const t = totales(filas)
  return (
    <div className="mt-2 text-right text-sm text-slate-600">
      Facturas {formatoCLP(t.facturas)} · Otros gastos {formatoCLP(t.otrosGastos)} · Total:{' '}
      <span className="font-semibold text-slate-800">{formatoCLP(t.total)}</span>
    </div>
  )
}

// Resumen de gastos de solo lectura: facturas y otros gastos juntos, por mes y
// por centro de costo, con filtros por categoría/subcategoría (ambas tablas) y
// por mes (tabla por centro de costo).
function Resumen() {
  const { facturas, gastos, subcategorias, cargando, error } = useDatosResumen()
  // '' = todos; SIN_CENTRO = solo lo que no tiene subcategoría; si no, id de categoría.
  const [idCategoria, setIdCategoria] = useState('')
  const [idSubcategoria, setIdSubcategoria] = useState('')
  // '' = todos los meses; si no, 'YYYY-MM'.
  const [mes, setMes] = useState('')

  const movs = useMemo(() => movimientos(facturas, gastos), [facturas, gastos])
  const indice = useMemo(() => indiceSubcategorias(subcategorias), [subcategorias])

  // Categorías que tienen subcategorías, por nombre; las inactivas se marcan.
  const categorias = useMemo(() => {
    const unicas = new Map()
    for (const s of subcategorias) if (s.categoria?.id) unicas.set(s.categoria.id, s.categoria)
    return [...unicas.values()].sort((a, b) => comparar(a.nombre, b.nombre))
  }, [subcategorias])

  const subcategoriasDeCategoria = useMemo(
    () =>
      subcategorias
        .filter((s) => s.categoria?.id === idCategoria)
        .sort((a, b) => comparar(a.nombre, b.nombre)),
    [subcategorias, idCategoria],
  )

  const filasMes = useMemo(
    () => resumenPorMes(movs, { idCategoria, idSubcategoria }, indice),
    [movs, idCategoria, idSubcategoria, indice],
  )
  const filasCentro = useMemo(
    () => resumenPorCentro(movs, { mes, idCategoria, idSubcategoria }, indice),
    [movs, mes, idCategoria, idSubcategoria, indice],
  )

  const elegirCategoria = (valor) => {
    setIdCategoria(valor)
    setIdSubcategoria('')
  }

  // Aviso de lo que no se pudo ubicar en un centro de costo (según los filtros).
  const sinCentro = filasCentro.find((f) => f.id === SIN_CENTRO)
  const filtrandoCentro = idCategoria !== ''

  return (
    <section className="mt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Resumen mensual</h2>
        <p className="mt-1 text-sm text-slate-600">
          Facturas y otros gastos juntos. Cada factura cuenta por su total con IVA, repartido entre sus líneas según su
          subtotal; cada línea va al centro de costo del insumo Okima vinculado a su insumo del proveedor. Las líneas
          sin insumo Okima vinculado quedan en "{ETIQUETA_SIN_CENTRO}" hasta que se vinculen en{' '}
          <Link to="/proveedores/por-vincular" className="font-medium text-indigo-700 hover:underline">
            Proveedores → Por vincular
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
          Centro de costo
          <select value={idCategoria} onChange={(e) => elegirCategoria(e.target.value)} className={`${claseInput} w-auto`}>
            <option value="">Todos</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.activo === false ? `${c.nombre} (inactiva)` : c.nombre}
              </option>
            ))}
            <option value={SIN_CENTRO}>{ETIQUETA_SIN_CENTRO}</option>
          </select>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
          Subcategoría
          <select
            value={idSubcategoria}
            onChange={(e) => setIdSubcategoria(e.target.value)}
            disabled={!idCategoria || idCategoria === SIN_CENTRO}
            className={`${claseInput} w-auto`}
          >
            <option value="">Todas</option>
            {subcategoriasDeCategoria.map((s) => (
              <option key={s.id} value={s.id}>
                {s.activo === false ? `${s.nombre} (inactiva)` : s.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-800">Por mes</h3>
        <p className="mt-1 text-sm text-slate-600">Del mes más reciente al más antiguo, según el centro de costo elegido.</p>
        <div className="mt-3">
          <TablaDatos
            columnas={columnasMes}
            filas={filasMes}
            nombreArchivo="resumen-gastos-por-mes"
            cargando={cargando}
            error={error}
            vacio={filtrandoCentro ? 'No hay gastos para este centro de costo.' : 'Todavía no hay facturas ni gastos.'}
          />
          {!cargando && !error && <LineaTotal filas={filasMes} />}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-800">
          Por centro de costo{mes ? ` — ${etiquetaMes(mes)}` : ''}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Una fila por subcategoría, agrupadas por centro de costo; el % es sobre el total de lo que se muestra.
        </p>

        {!cargando && !error && sinCentro && sinCentro.total > 0 && idCategoria !== SIN_CENTRO && (
          <div
            className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {formatoCLP(sinCentro.total)} sin centro de costo
              {mes ? ` en ${etiquetaMes(mes)}` : ''}: {formatoCLP(sinCentro.facturas)} de líneas de factura sin insumo
              Okima vinculado (se vinculan en{' '}
              <Link to="/proveedores/por-vincular" className="font-medium underline">
                Proveedores → Por vincular
              </Link>
              ) y {formatoCLP(sinCentro.otrosGastos)} de otros gastos sin subcategoría.
            </p>
          </div>
        )}

        <div className="mt-3">
          <TablaDatos
            columnas={columnasCentro}
            filas={filasCentro}
            nombreArchivo={mes ? `resumen-gastos-por-centro-${mes}` : 'resumen-gastos-por-centro'}
            cargando={cargando}
            error={error}
            vacio={filtrandoCentro || mes ? 'No hay gastos para estos filtros.' : 'Todavía no hay facturas ni gastos.'}
            barra={<FiltroMes meses={mesesDeMovimientos(movs)} valor={mes} onChange={setMes} />}
          />
          {!cargando && !error && <LineaTotal filas={filasCentro} />}
        </div>
      </div>
    </section>
  )
}

export default Resumen
