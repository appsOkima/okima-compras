import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, Plus } from 'lucide-react'
import { filtrarOpciones } from '../lib/opciones'
import { claseInput } from './estilos'

// Tope de opciones dibujadas: con catálogos grandes se acota escribiendo.
const MAXIMO_VISIBLES = 50
// Alto máximo de la lista (max-h-60) para decidir si se abre hacia arriba.
const ALTO_LISTA = 240

// Selector con búsqueda: input de texto + lista filtrada (sin mayúsculas ni tildes).
// opciones = [{ valor, etiqueta, detalle? }]; onChange recibe el valor elegido, o
// '' cuando se borra la selección escribiendo encima. `etiqueta` es el nombre
// accesible cuando no hay un <label htmlFor={id}> (ej. dentro de una tabla).
// `onCrear(texto)` (opcional, creación al vuelo): si el texto no es igual a
// ninguna opción, agrega al final "Crear '<texto>'"; con opciones parecidas las
// muestra primero y avisa en esa opción. Quien la recibe decide cómo crear
// (nunca se crea en silencio desde aquí). Al salir del campo con un texto sin
// coincidencia exacta, se propone crear ese registro en lugar de borrar el texto.
function Combobox({
  opciones,
  valor,
  onChange,
  onCrear,
  placeholder = 'Buscar…',
  id,
  etiqueta,
  disabled = false,
  className = '',
}) {
  const idLista = useId()
  const input = useRef(null)
  // null = no se está escribiendo: el input muestra la opción elegida.
  const [texto, setTexto] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const [posicion, setPosicion] = useState(null)

  const seleccionada = opciones.find((o) => o.valor === valor) ?? null
  const { visibles, restantes, crear } = useMemo(
    () => filtrarOpciones(opciones, texto, { conCrear: Boolean(onCrear), maximo: MAXIMO_VISIBLES }),
    [opciones, texto, onCrear],
  )
  // La opción "Crear" va después de las visibles, con el índice siguiente.
  const totalItems = visibles.length + (crear ? 1 : 0)
  const indice = Math.min(resaltado, totalItems - 1)

  // La lista va con position: fixed para que no la recorte una tabla con scroll
  // horizontal; se abre hacia arriba si no cabe abajo.
  const ubicar = useCallback(() => {
    const r = input.current?.getBoundingClientRect()
    if (!r) return
    const espacioAbajo = window.innerHeight - r.bottom
    const haciaArriba = espacioAbajo < ALTO_LISTA && r.top > espacioAbajo
    setPosicion({
      left: r.left,
      width: Math.max(r.width, 240),
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [])

  useEffect(() => {
    if (!abierto) return
    // capture: también reacciona al scroll de contenedores (ej. la tabla).
    window.addEventListener('scroll', ubicar, true)
    window.addEventListener('resize', ubicar)
    return () => {
      window.removeEventListener('scroll', ubicar, true)
      window.removeEventListener('resize', ubicar)
    }
  }, [abierto, ubicar])

  // Mantiene visible la opción resaltada al moverse con el teclado.
  useEffect(() => {
    if (abierto && indice >= 0) document.getElementById(`${idLista}-${indice}`)?.scrollIntoView({ block: 'nearest' })
  }, [abierto, indice, idLista])

  const abrir = () => {
    if (abierto || disabled) return
    ubicar()
    setAbierto(true)
  }

  const cerrar = () => {
    setAbierto(false)
    setTexto(null)
  }

  const elegir = (opcion) => {
    onChange(opcion.valor)
    cerrar()
  }

  const proponerCreacion = () => {
    const propuesta = crear.texto
    cerrar()
    onCrear(propuesta)
  }

  // Al salir del campo con un texto que no coincide con ninguna opción, se pasa a
  // "crear" ese registro (abre el mini-formulario de confirmación) en vez de borrar lo escrito.
  const alPerderFoco = () => {
    // Si el foco sigue en el input, la ventana perdió el foco (cambio de pestaña): no hacer nada.
    if (document.activeElement === input.current) return
    if (crear) proponerCreacion()
    else cerrar()
  }

  const activar = (i) => {
    if (i < visibles.length) elegir(visibles[i])
    else if (crear) proponerCreacion()
  }

  const alEscribir = (e) => {
    setTexto(e.target.value)
    setResaltado(0)
    abrir()
    // Escribir encima de una selección la anula hasta elegir otra.
    if (valor) onChange('')
  }

  const alPresionar = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!abierto) abrir()
      else setResaltado(Math.min(indice + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado(Math.max(indice - 1, 0))
    } else if (e.key === 'Enter' && abierto && indice >= 0) {
      e.preventDefault()
      activar(indice)
    } else if (e.key === 'Escape' && abierto) {
      // Sin propagar: dentro de un Modal, Escape cierra la lista y no el diálogo.
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-label={etiqueta}
        aria-activedescendant={abierto && indice >= 0 ? `${idLista}-${indice}` : undefined}
        autoComplete="off"
        value={texto ?? seleccionada?.etiqueta ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={alEscribir}
        onClick={abrir}
        onKeyDown={alPresionar}
        onBlur={alPerderFoco}
        className={`${claseInput} pr-8`}
      />
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {abierto && posicion && (
        <ul
          id={idLista}
          role="listbox"
          style={{ position: 'fixed', ...posicion }}
          className="z-50 max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {visibles.length === 0 && !crear ? (
            <li className="px-3 py-2 text-slate-500">Sin coincidencias</li>
          ) : (
            visibles.map((opcion, i) => (
              <li
                key={opcion.valor}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={opcion.valor === valor}
                // mousedown sin foco: el input no pierde el foco (onBlur) antes del clic.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(opcion)}
                onMouseEnter={() => setResaltado(i)}
                className={`cursor-pointer px-3 py-2 ${i === indice ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700'}`}
              >
                <span className={`block truncate ${opcion.valor === valor ? 'font-semibold' : ''}`}>{opcion.etiqueta}</span>
                {opcion.detalle && <span className="block truncate text-xs text-slate-500">{opcion.detalle}</span>}
              </li>
            ))
          )}
          {restantes > 0 && (
            <li className="px-3 py-2 text-xs text-slate-500">{restantes} más… escribe para acotar.</li>
          )}
          {crear && (
            <li
              id={`${idLista}-${visibles.length}`}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={proponerCreacion}
              onMouseEnter={() => setResaltado(visibles.length)}
              className={`flex cursor-pointer items-start gap-2 border-t border-slate-100 px-3 py-2 ${
                crear.conSimilares
                  ? indice === visibles.length
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-amber-800'
                  : indice === visibles.length
                    ? 'bg-indigo-50 text-indigo-800'
                    : 'text-indigo-700'
              }`}
            >
              {crear.conSimilares ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Plus className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 break-words">
                {crear.conSimilares ? 'Ya existen parecidos — crear de todos modos ' : 'Crear '}
                <span className="font-semibold">'{crear.texto}'</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default Combobox
