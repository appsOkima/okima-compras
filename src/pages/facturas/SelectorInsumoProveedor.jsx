import { useId, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Plus } from 'lucide-react'
import Combobox from '../../components/Combobox'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { mensajeError } from '../../lib/errores'
import { formatoCompra } from '../../lib/formato'
import { buscarSimilares } from '../../lib/texto'

// Detalle de cada opción: código, formato de compra y si suma stock.
function detalleItem(item) {
  const formato = formatoCompra(item.cantidad_formato, item.formato_unidad)
  return [
    item.codigo,
    formato !== '—' ? formato : null,
    item.insumo_okima ? `Insumo Okima: ${item.insumo_okima.nombre}` : 'Sin vínculo a insumo Okima',
  ]
    .filter(Boolean)
    .join(' · ')
}

// Insumo del catálogo del proveedor elegido, con creación al vuelo (skill
// creacion-al-vuelo): pide SOLO el nombre y hereda el proveedor de la factura.
// Nunca se pide ni se ofrece el insumo Okima: ese vínculo lo hace el
// administrador en Proveedores → Por vincular.
function SelectorInsumoProveedor({ id, valor, onChange, catalogo, idProveedor, onCrearInsumo, cargando = false }) {
  const idBase = useId()
  // null = sin mini-formulario abierto; si no, el nombre a crear.
  const [nombreNuevo, setNombreNuevo] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(
    () => catalogo.map((item) => ({ valor: item.id, etiqueta: item.nombre, detalle: detalleItem(item) })),
    [catalogo],
  )
  // Parecidos solo dentro del catálogo de este proveedor.
  const similares = useMemo(
    () => (nombreNuevo === null ? [] : buscarSimilares(nombreNuevo, catalogo)),
    [nombreNuevo, catalogo],
  )

  const abrir = (texto) => {
    setNombreNuevo(texto)
    setError('')
  }

  const cerrar = () => {
    setNombreNuevo(null)
    setError('')
  }

  const usarExistente = (item) => {
    cerrar()
    onChange(item.id)
  }

  const crear = async () => {
    if (guardando) return
    const nombre = nombreNuevo.trim().replace(/\s+/g, ' ')
    if (!nombre) {
      setError('Escribe el nombre.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const creado = await onCrearInsumo({ nombre, id_proveedor: idProveedor })
      setNombreNuevo(null)
      onChange(creado.id)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const alPresionar = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      crear()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    }
  }

  const placeholder = !idProveedor
    ? 'Elige primero el proveedor'
    : cargando
      ? 'Cargando catálogo…'
      : 'Buscar o crear insumo del proveedor…'

  return (
    <div className="space-y-2">
      <Combobox
        id={id}
        opciones={opciones}
        valor={valor}
        onChange={onChange}
        onCrear={idProveedor ? abrir : undefined}
        placeholder={placeholder}
        disabled={!idProveedor || cargando || nombreNuevo !== null}
      />

      {nombreNuevo !== null && (
        <div
          className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/60 p-3"
          role="group"
          aria-label="Nuevo insumo del proveedor"
          onKeyDown={alPresionar}
        >
          <div>
            <label htmlFor={`${idBase}-nombre`} className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-700">
              <Plus className="h-3.5 w-3.5 text-indigo-700" />
              Nuevo insumo del proveedor — nombre <span className="text-red-600">*</span>
            </label>
            <input
              id={`${idBase}-nombre`}
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              autoFocus
              className={claseInput}
            />
            <p className="mt-1 text-xs text-slate-500">
              El resto de los datos (código, precio, formato) y el vínculo al insumo Okima se completan en Proveedores.
            </p>
          </div>

          {similares.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800" role="alert">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Este proveedor ya tiene {similares.length === 1 ? 'uno parecido' : 'parecidos'}. ¿Es alguno de estos?
              </p>
              <ul className="mt-1 space-y-1">
                {similares.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 pl-6">
                    <span className="min-w-0 truncate">
                      {item.nombre}
                      {item.codigo && <span className="text-amber-700/80"> ({item.codigo})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => usarExistente(item)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-900 underline hover:bg-amber-100"
                    >
                      Usar este
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={cerrar} className={claseBotonSecundario}>
              Volver
            </button>
            <button type="button" onClick={crear} disabled={guardando} className={claseBotonPrimario}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {similares.length > 0 ? 'Crear de todos modos' : 'Crear insumo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SelectorInsumoProveedor
