import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import OpcionesSelect from './OpcionesSelect'
import { claseInput } from './estilos'

const comparar = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })

// Selector de subcategoría agrupado por categoría (centro de costo). Muestra solo
// las activas (subcategoría y categoría), pero siempre incluye el valor actual
// aunque se haya desactivado, para no perderlo al editar un registro antiguo.
// onChange recibe el id elegido ('' si se deja vacío).
function SelectorSubcategoria({ valor, onChange, requerido = false, id, className = '' }) {
  const [subcategorias, setSubcategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    supabase
      .from('subcategorias')
      .select('id, nombre, activo, categoria:categorias(nombre, activo)')
      .then(({ data, error: errorConsulta }) => {
        if (!vigente) return
        if (errorConsulta) setError(errorConsulta)
        else setSubcategorias(data ?? [])
        setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  const opciones = useMemo(
    () =>
      subcategorias
        .filter((s) => (s.activo && s.categoria?.activo !== false) || s.id === valor)
        .map((s) => ({
          valor: s.id,
          etiqueta: s.activo && s.categoria?.activo !== false ? s.nombre : `${s.nombre} (inactiva)`,
          grupo: s.categoria?.nombre ?? 'Sin categoría',
        }))
        .sort((a, b) => comparar(a.grupo, b.grupo) || comparar(a.etiqueta, b.etiqueta)),
    [subcategorias, valor],
  )

  const textoVacio = cargando
    ? 'Cargando subcategorías…'
    : error
      ? 'No se pudieron cargar las subcategorías'
      : requerido
        ? 'Selecciona una subcategoría…'
        : 'Sin subcategoría'

  return (
    <select
      id={id}
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      required={requerido}
      disabled={cargando}
      className={`${claseInput} ${className}`}
    >
      <option value="">{textoVacio}</option>
      <OpcionesSelect opciones={opciones} />
    </select>
  )
}

export default SelectorSubcategoria
