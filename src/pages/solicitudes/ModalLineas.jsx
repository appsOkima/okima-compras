import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Search } from 'lucide-react'
import Modal from '../../components/Modal'
import { claseInput } from '../../components/estilos'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha, formatoNumero } from '../../lib/formato'
import { lineaBoletaParaVincular, lineaFacturaParaVincular, lineasParaSolicitud } from '../../lib/vinculacion'
import { supabase } from '../../lib/supabase'
import { vincularLinea } from '../facturas/vincularLinea'

// Por tipo de documento: tabla, consulta y normalizador. Las boletas no traen insumo del
// proveedor ni vínculos. Solo líneas sin solicitud y de
// documentos vigentes (!inner + filtro del embebido), las más recientes primero y con
// tope: la búsqueda del modal opera sobre las cargadas.
const MAXIMO_LINEAS = 500
const VINCULOS = 'insumo_proveedor:insumos_proveedores(nombre, vinculos:insumos_proveedores_okima(id_insumo_okima))'
const FUENTES = [
  {
    tipo: 'factura',
    tabla: 'detalle_facturas',
    documento: 'factura',
    select: `id, cantidad, subtotal, id_solicitud_compra, factura:facturas!inner(numero_factura, fecha, estado_documento, proveedor:proveedores(nombre)), ${VINCULOS}`,
    normalizar: lineaFacturaParaVincular,
  },
  {
    tipo: 'boleta',
    tabla: 'detalle_boletas',
    documento: 'boleta',
    select: `id, descripcion, cantidad, subtotal, id_solicitud_compra, boleta:boletas!inner(numero_documento, fecha, estado_documento, proveedor:proveedores(nombre), lineas:detalle_boletas(descripcion, created_at))`,
    normalizar: lineaBoletaParaVincular,
  },
]
const TIPOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'factura', etiqueta: 'Facturas' },
  { valor: 'boleta', etiqueta: 'Boletas' },
]

async function cargarLineas() {
  const resultados = await Promise.all(
    FUENTES.map((f) =>
      supabase
        .from(f.tabla)
        .select(f.select)
        .is('id_solicitud_compra', null)
        .eq(`${f.documento}.estado_documento`, 'vigente')
        .order('created_at', { ascending: false })
        .limit(MAXIMO_LINEAS),
    ),
  )
  const fallo = resultados.find((r) => r.error)
  if (fallo) throw fallo.error
  return resultados.flatMap((r, i) => (r.data ?? []).map(FUENTES[i].normalizar))
}

// Modal inverso (Sprint2 §3.3): para una solicitud pendiente sin ninguna línea, elegir una
// línea de factura o de boleta sin solicitud. Las líneas cuyo insumo Okima coincide con el
// de la solicitud van primero. Vincular una línea ya guardada no suma stock.
function ModalLineas({ solicitud, onVinculado, onCerrar }) {
  const [lineas, setLineas] = useState(null)
  const [errorCarga, setErrorCarga] = useState(null)
  const [tipo, setTipo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [enCurso, setEnCurso] = useState(false)
  const [errorVincular, setErrorVincular] = useState('')

  useEffect(() => {
    let vigente = true
    cargarLineas().then(
      (datos) => vigente && setLineas(datos),
      (e) => vigente && setErrorCarga(e),
    )
    return () => {
      vigente = false
    }
  }, [])

  const filas = useMemo(() => lineasParaSolicitud(lineas, solicitud, { tipo, busqueda }), [lineas, solicitud, tipo, busqueda])

  const elegir = async (linea) => {
    setErrorVincular('')
    setEnCurso(true)
    try {
      await vincularLinea(FUENTES.find((f) => f.tipo === linea.tipo).tabla, linea.id, solicitud.id)
      await onVinculado()
    } catch (e) {
      setErrorVincular(mensajeError(e))
      setEnCurso(false)
    }
  }

  const nombre = solicitud.insumo_nombre ?? solicitud.insumo?.nombre ?? ''
  const cargando = lineas === null && !errorCarga

  return (
    <Modal titulo={`Vincular «${nombre}» a una línea`} onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar documento, proveedor o insumo…"
            aria-label="Buscar línea"
            className={`${claseInput} pl-9`}
          />
        </div>
        <div className="inline-flex gap-1" role="group" aria-label="Tipo de documento">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={tipo === t.valor}
              onClick={() => setTipo(t.valor)}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                tipo === t.valor
                  ? 'border-primary-300 bg-primary-50 text-primary-darker'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Líneas sin solicitud de documentos vigentes; primero las del mismo insumo Okima, luego las más recientes (hasta{' '}
        {MAXIMO_LINEAS} por tipo). Vincular una línea ya guardada no suma stock.
      </p>

      {(errorCarga || errorVincular) && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorCarga ? `No se pudieron cargar las líneas: ${mensajeError(errorCarga)}` : errorVincular}
        </p>
      )}

      {cargando ? (
        <p className="mt-4 flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando líneas…
        </p>
      ) : (
        !errorCarga &&
        (filas.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {busqueda || tipo ? 'Ninguna línea coincide con los filtros.' : 'No hay líneas sin solicitud.'}
          </p>
        ) : (
          <ul className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {filas.map(({ linea: l, coincide }) => (
              <li key={`${l.tipo}-${l.id}`}>
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() => elegir(l)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-slate-200 bg-white p-3 text-left text-sm hover:bg-primary-50/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">
                      {l.documento} <span className="font-normal text-slate-500">· {formatoFecha(l.fecha)}</span>
                    </span>
                    <span className="block text-xs text-slate-500">
                      {[l.proveedor, l.descripcion].filter(Boolean).join(' · ') || 'Sin proveedor ni descripción'}
                    </span>
                    {coincide && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                        <Check className="h-3 w-3" />
                        Coincide con el insumo
                      </span>
                    )}
                  </span>
                  <span className="text-right text-xs text-slate-600">
                    <span className="block">× {formatoNumero(l.cantidad)}</span>
                    <span className="block font-medium">{formatoCLP(l.subtotal)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))
      )}
    </Modal>
  )
}

export default ModalLineas
