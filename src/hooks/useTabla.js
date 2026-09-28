import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ORDEN_POR_DEFECTO = { columna: 'nombre', ascendente: true }

// Orden local para no recargar toda la tabla tras crear o editar un registro.
function comparar(columna, ascendente) {
  return (a, b) => {
    const va = a?.[columna]
    const vb = b?.[columna]
    // Los vacíos siempre al final, igual que "nulls last".
    if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1
    if (vb === null || vb === undefined) return -1
    const r =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base', numeric: true })
    return ascendente ? r : -r
  }
}

// Carga una tabla de Supabase y expone el CRUD básico sobre ella.
// Las opciones se desarman en primitivos para que un objeto literal nuevo en
// cada render no dispare otra consulta.
export function useTabla(tabla, { select = '*', orden = ORDEN_POR_DEFECTO } = {}) {
  const columna = orden?.columna ?? ORDEN_POR_DEFECTO.columna
  const ascendente = orden?.ascendente ?? ORDEN_POR_DEFECTO.ascendente

  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  // Descarta respuestas de consultas viejas si se recarga antes de que terminen.
  const ultimaConsulta = useRef(0)

  const ordenar = useCallback((lista) => [...lista].sort(comparar(columna, ascendente)), [columna, ascendente])

  // Consulta y vuelca el resultado; el estado solo se toca cuando llega la respuesta.
  const consultar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current
    const { data, error: errorConsulta } = await supabase
      .from(tabla)
      .select(select)
      .order(columna, { ascending: ascendente, nullsFirst: false })
    if (consulta !== ultimaConsulta.current) return
    setError(errorConsulta ?? null)
    setFilas(errorConsulta ? [] : ordenar(data ?? []))
    setCargando(false)
  }, [tabla, select, columna, ascendente, ordenar])

  useEffect(() => {
    const contador = ultimaConsulta
    consultar()
    // Al desmontar se invalida la consulta en curso para no actualizar estado huérfano.
    return () => {
      contador.current++
    }
  }, [consultar])

  // Recarga manual (desde un evento): aquí sí se marca "cargando" de inmediato.
  const recargar = useCallback(() => {
    setCargando(true)
    return consultar()
  }, [consultar])

  // crear/actualizar devuelven la fila con sus relaciones embebidas y lanzan el
  // error para que el formulario lo muestre.
  const crear = useCallback(
    async (valores) => {
      const { data, error: errorGuardar } = await supabase.from(tabla).insert(valores).select(select).single()
      if (errorGuardar) throw errorGuardar
      setFilas((actuales) => ordenar([...actuales, data]))
      return data
    },
    [tabla, select, ordenar],
  )

  const actualizar = useCallback(
    async (id, valores) => {
      const { data, error: errorGuardar } = await supabase
        .from(tabla)
        .update(valores)
        .eq('id', id)
        .select(select)
        .single()
      if (errorGuardar) throw errorGuardar
      setFilas((actuales) => ordenar(actuales.map((fila) => (fila.id === id ? data : fila))))
      return data
    },
    [tabla, select, ordenar],
  )

  const eliminar = useCallback(
    async (id) => {
      const { error: errorEliminar } = await supabase.from(tabla).delete().eq('id', id)
      if (errorEliminar) throw errorEliminar
      setFilas((actuales) => actuales.filter((fila) => fila.id !== id))
    },
    [tabla],
  )

  return { filas, cargando, error, recargar, crear, actualizar, eliminar }
}
