// Aviso de duplicados de los formularios de Mantenedor (modal o página propia).
// Es un chequeo de aplicación: no hay UNIQUE en la base (ver lib/texto.js).
import { buscarSimilares, normalizar } from './texto.js'

// Parecidos por nombre entre las `filas` cargadas (incluidas las inactivas), sin el
// propio `registro` (null al crear). Al editar solo se avisa si cambió el nombre o
// su ámbito (`filtroDuplicados(fila, valores)`, ej. misma subcategoría).
// `duplicadosAdicionales(valores, candidatos, registro)` suma otros criterios
// (ej. mismo RUT) y decide por su cuenta si aplican al editar; no repite los ya
// encontrados por nombre. `duplicadosPorNombre = false` deja solo los adicionales.
export function buscarDuplicados({
  valores,
  filas,
  registro = null,
  filtroDuplicados,
  duplicadosAdicionales,
  duplicadosPorNombre = true,
}) {
  const candidatos = filas.filter(
    (f) => f.id !== registro?.id && (!filtroDuplicados || filtroDuplicados(f, valores)),
  )
  const nombreSinCambios =
    registro &&
    normalizar(valores.nombre) === normalizar(registro.nombre) &&
    (!filtroDuplicados || filtroDuplicados(registro, valores))
  const porNombre = !duplicadosPorNombre || nombreSinCambios ? [] : buscarSimilares(valores.nombre, candidatos)
  if (!duplicadosAdicionales) return porNombre
  const yaListados = new Set(porNombre.map((r) => r.id))
  const extra = (duplicadosAdicionales(valores, candidatos, registro) ?? []).filter((r) => !yaListados.has(r.id))
  return [...porNombre, ...extra]
}
