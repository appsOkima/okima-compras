import { describe, expect, it } from 'vitest'
import { normalizarNotas, tieneNotas } from './notas'

describe('normalizarNotas', () => {
  it('recorta los espacios al borde', () => {
    expect(normalizarNotas('  llamar antes  ')).toBe('llamar antes')
  })
  it('vacío, solo espacios o saltos de línea quedan null', () => {
    expect(normalizarNotas('')).toBeNull()
    expect(normalizarNotas('   \n\t ')).toBeNull()
  })
  it('null y undefined quedan null', () => {
    expect(normalizarNotas(null)).toBeNull()
    expect(normalizarNotas(undefined)).toBeNull()
  })
  it('conserva los saltos de línea internos', () => {
    expect(normalizarNotas('a\nb')).toBe('a\nb')
  })
})

describe('tieneNotas', () => {
  it('es falso para null, undefined, vacío o solo espacios', () => {
    expect(tieneNotas(null)).toBe(false)
    expect(tieneNotas(undefined)).toBe(false)
    expect(tieneNotas('')).toBe(false)
    expect(tieneNotas('  \n ')).toBe(false)
  })
  it('es verdadero con contenido', () => {
    expect(tieneNotas('Entregar solo por la mañana')).toBe(true)
  })
})
