import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { coincide } from '../lib/texto'
import { claseInput } from './estilos'

// Tope de opciones dibujadas: con catálogos grandes se acota escribiendo.
const MAXIMO_VISIBLES = 50
// Alto máximo de la lista (max-h-60) para decidir si se abre hacia arriba.
const ALTO_LISTA = 240

// Selector con búsqueda: input de texto + lista filtrada (sin mayúsculas ni tildes).
// opciones = [{ valor, etiqueta, detalle? }]; onChange recibe el valor elegido, o
// '' cuando se borra la selección escribiendo encima. `etiqueta` es el nombre
// accesible cuando no hay un <label htmlFor={id}> (ej. dentro de una tabla).
// Pensado para sumar después `onCrear` (creación al vuelo): iría como una opción
// extra al final de la lista cuando el texto no calce con ninguna.
function Combobox({ opciones, valor, onChange, placeholder = 'Buscar…', id, etiqueta, disabled = false, className = '' }) {
  const idLista = useId()
  const input = useRef(null)
  // null = no se está escribiendo: el input muestra la opción elegida.
  const [texto, setTexto] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const [posicion, setPosicion] = useState(null)

  const seleccionada = opciones.find((o) => o.valor === valor) ?? null
  const coincidentes = useMemo(
    () => opciones.filter((o) => coincide(`${o.etiqueta} ${o.detalle ?? ''}`, texto ?? '')),
    [opciones, texto],
  )
  const visibles = coincidentes.slice(0, MAXIMO_VISIBLES)
  const indice = Math.min(resaltado, visibles.length - 1)

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
      else setResaltado(Math.min(indice + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado(Math.max(indice - 1, 0))
    } else if (e.key === 'Enter' && abierto && visibles[indice]) {
      e.preventDefault()
      elegir(visibles[indice])
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
        onBlur={cerrar}
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
          {visibles.length === 0 ? (
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
          {coincidentes.length > MAXIMO_VISIBLES && (
            <li className="px-3 py-2 text-xs text-slate-500">
              {coincidentes.length - MAXIMO_VISIBLES} más… escribe para acotar.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default Combobox
