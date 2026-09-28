import { useId, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Plus } from 'lucide-react'
import Combobox from '../../components/Combobox'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { mensajeError } from '../../lib/errores'
import { buscarSimilares } from '../../lib/texto'

// Selector de insumo Okima con creación al vuelo (skill creacion-al-vuelo): si
// el texto no existe, se abre aquí mismo un mini-formulario con nombre y
// subcategoría (ambos obligatorios); el resto de los campos del insumo queda
// vacío y aparece en el filtro "Incompletos" de Insumos Okima.
// No es un <form>: va dentro del formulario de la solicitud (no se anidan forms).
function SelectorInsumo({ id, valor, onChange, insumos, onCrearInsumo, cargando = false }) {
  const idBase = useId()
  // null = sin mini-formulario abierto.
  const [nuevo, setNuevo] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(
    () => insumos.map((i) => ({ valor: i.id, etiqueta: i.nombre, detalle: i.subcategoria?.nombre })),
    [insumos],
  )
  // Se recalcula si se edita el nombre en el mini-formulario: nunca crear en silencio.
  const similares = useMemo(() => (nuevo ? buscarSimilares(nuevo.nombre, insumos) : []), [nuevo, insumos])

  const abrir = (texto) => {
    setNuevo({ nombre: texto, id_subcategoria: '' })
    setError('')
  }

  const cerrar = () => {
    setNuevo(null)
    setError('')
  }

  const usarExistente = (insumo) => {
    onChange(insumo.id)
    cerrar()
  }

  const crear = async () => {
    if (guardando) return
    const nombre = nuevo.nombre.trim().replace(/\s+/g, ' ')
    if (!nombre || !nuevo.id_subcategoria) {
      setError('Completa el nombre y la subcategoría.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      // Solo nombre y subcategoría: el resto lo completa el administrador después.
      const creado = await onCrearInsumo({ nombre, id_subcategoria: nuevo.id_subcategoria })
      onChange(creado.id)
      setNuevo(null)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  // Enter en el nombre no debe enviar la solicitud entera (en los botones sigue
  // funcionando normal) ni Escape cerrar el diálogo.
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

  return (
    <div className="space-y-2">
      <Combobox
        id={id}
        opciones={opciones}
        valor={valor}
        onChange={onChange}
        onCrear={abrir}
        placeholder={cargando ? 'Cargando insumos…' : 'Buscar o crear insumo…'}
        disabled={cargando || nuevo !== null}
      />

      {nuevo && (
        <div
          className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/60 p-3"
          role="group"
          aria-label="Nuevo insumo Okima"
          onKeyDown={alPresionar}
        >
          <p className="flex items-center gap-2 text-sm font-medium text-indigo-900">
            <Plus className="h-4 w-4" />
            Nuevo insumo Okima
          </p>
          <div>
            <label htmlFor={`${idBase}-nombre`} className="mb-1 block text-xs font-medium text-slate-700">
              Nombre <span className="text-red-600">*</span>
            </label>
            <input
              id={`${idBase}-nombre`}
              type="text"
              value={nuevo.nombre}
              onChange={(e) => setNuevo((actual) => ({ ...actual, nombre: e.target.value }))}
              autoFocus
              className={claseInput}
            />
          </div>
          <div>
            <label htmlFor={`${idBase}-subcategoria`} className="mb-1 block text-xs font-medium text-slate-700">
              Subcategoría <span className="text-red-600">*</span>
            </label>
            <SelectorSubcategoria
              id={`${idBase}-subcategoria`}
              valor={nuevo.id_subcategoria}
              onChange={(v) => setNuevo((actual) => ({ ...actual, id_subcategoria: v }))}
              requerido
            />
          </div>

          {similares.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800" role="alert">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Ya existe{similares.length === 1 ? ' uno parecido' : 'n parecidos'}. ¿Es alguno de estos?
              </p>
              <ul className="mt-1 space-y-1">
                {similares.slice(0, 5).map((insumo) => (
                  <li key={insumo.id} className="flex items-center justify-between gap-2 pl-6">
                    <span className="min-w-0 truncate">
                      {insumo.nombre}
                      {insumo.subcategoria?.nombre && (
                        <span className="text-amber-700/80"> ({insumo.subcategoria.nombre})</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => usarExistente(insumo)}
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

export default SelectorInsumo
