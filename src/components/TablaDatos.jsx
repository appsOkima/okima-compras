import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Download, Loader2 } from 'lucide-react'
import { descargarCsv, generarCsv } from '../lib/csv'
import { mensajeError } from '../lib/errores'
import { esOrdenable, ordenarFilas, paginar } from '../lib/tabla'
import { claseBotonSecundario } from './estilos'

// Tabla única de la app, con exportación CSV de las filas que se están mostrando
// (ya filtradas). Todas las vistas de tabla la reutilizan.
// Una columna con `soloCsv` no se muestra en pantalla (ej. datos secundarios) y
// una con `soloTabla` no se exporta (ej. controles o valores ya desglosados).
// Una con `noImprimir` se ve en pantalla pero no en papel; `claseFila(fila)`
// agrega clases a cada fila (ej. un acento de color por urgencia).
// El encabezado ordena por columna (ver `valorOrden` en lib/tabla.js; `orden(fila)`
// opcional en la columna) y las filas se paginan de a 50; en papel salen todas.
function TablaDatos({
  columnas: todasLasColumnas,
  filas: filasOriginales,
  nombreArchivo,
  cargando,
  error,
  vacio = 'No hay registros.',
  acciones,
  barra,
  claseFila,
}) {
  const [orden, setOrden] = useState({ clave: null, direccion: null })
  // La página se guarda con la firma del conjunto mostrado: si cambia el orden o las
  // filas (ej. al buscar), vale la 1 sin necesidad de un efecto.
  const [nav, setNav] = useState({ pagina: 1, firma: '' })

  const columnas = todasLasColumnas.filter((c) => !c.soloCsv)
  const filas = ordenarFilas(
    filasOriginales,
    columnas.find((c) => c.clave === orden.clave),
    orden.direccion,
  )
  const firma = `${orden.clave}|${orden.direccion}|${filas.length}|${filas[0]?.id}`
  const { pagina, totalPaginas, inicio, fin } = paginar(filas.length, nav.firma === firma ? nav.pagina : 1)
  const irAPagina = (p) => setNav({ pagina: p, firma })

  const ciclarOrden = (clave) =>
    setOrden((o) => {
      if (o.clave !== clave) return { clave, direccion: 'asc' }
      if (o.direccion === 'asc') return { clave, direccion: 'desc' }
      return { clave: null, direccion: null }
    })

  const exportar = () => {
    const columnasCsv = todasLasColumnas.filter((c) => !c.soloTabla).map((c) => ({
      titulo: c.titulo,
      valor: (fila) => (c.csv ? c.csv(fila) : fila[c.clave]),
    }))
    descargarCsv(nombreArchivo, generarCsv(filas, columnasCsv))
  }

  const alinear = (c) => `${c.alinear === 'derecha' ? 'text-right' : 'text-left'}${c.noImprimir ? ' print:hidden' : ''}`
  const totalColumnas = columnas.length + (acciones ? 1 : 0)

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 print:hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{barra}</div>
        <span className="text-xs text-slate-500">
          {filas.length} {filas.length === 1 ? 'registro' : 'registros'}
        </span>
        <button
          type="button"
          onClick={exportar}
          disabled={cargando || filas.length === 0}
          className={claseBotonSecundario}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      {/* En papel no hay scroll: la tabla se ajusta al ancho de la hoja (ver index.css). */}
      <div className="overflow-x-auto print:overflow-visible">
        <table className="tabla-datos min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columnas.map((c) => {
                const ordenable = esOrdenable(c, filasOriginales)
                return (
                  <th
                    key={c.clave}
                    scope="col"
                    aria-sort={ordenable ? ariaSort(c, orden) : undefined}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${alinear(c)}`}
                  >
                    {ordenable ? <BotonOrden columna={c} orden={orden} onClick={() => ciclarOrden(c.clave)} /> : c.titulo}
                  </th>
                )
              })}
              {acciones && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 print:hidden">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <FilaMensaje columnas={totalColumnas}>
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </FilaMensaje>
            ) : error ? (
              <FilaMensaje columnas={totalColumnas} tono="error">
                <AlertCircle className="h-4 w-4" /> No se pudieron cargar los datos: {mensajeError(error)}
              </FilaMensaje>
            ) : filas.length === 0 ? (
              <FilaMensaje columnas={totalColumnas}>{vacio}</FilaMensaje>
            ) : (
              filas.map((fila, i) => (
                <tr
                  key={fila.id}
                  className={`odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/50 ${i < inicio || i >= fin ? 'hidden print:table-row' : ''} ${claseFila ? claseFila(fila) : ''}`}
                >
                  {columnas.map((c) => (
                    <td key={c.clave} className={`px-4 py-2.5 align-top text-slate-700 ${alinear(c)}`}>
                      {c.render ? c.render(fila) : fila[c.clave]}
                    </td>
                  ))}
                  {acciones && (
                    <td className="whitespace-nowrap px-4 py-2 text-right align-top print:hidden">{acciones(fila)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!cargando && !error && totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 print:hidden">
          <span className="text-xs text-slate-500">
            Mostrando {inicio + 1}–{fin} de {filas.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => irAPagina(pagina - 1)} disabled={pagina <= 1} className={claseBotonSecundario}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button type="button" onClick={() => irAPagina(pagina + 1)} disabled={pagina >= totalPaginas} className={claseBotonSecundario}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ariaSort(columna, orden) {
  if (orden.clave !== columna.clave) return 'none'
  return orden.direccion === 'asc' ? 'ascending' : 'descending'
}

function BotonOrden({ columna, orden, onClick }) {
  const activa = orden.clave === columna.clave
  const Icono = !activa ? ChevronsUpDown : orden.direccion === 'asc' ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded uppercase tracking-wide hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 print:cursor-auto"
    >
      {columna.titulo}
      <Icono className={`h-3.5 w-3.5 shrink-0 print:hidden ${activa ? 'text-indigo-600' : 'text-slate-300'}`} aria-hidden="true" />
    </button>
  )
}

function FilaMensaje({ columnas, tono, children }) {
  return (
    <tr>
      <td colSpan={columnas} className={`px-4 py-10 text-center ${tono === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
        <span className="inline-flex items-center gap-2">{children}</span>
      </td>
    </tr>
  )
}

export default TablaDatos
