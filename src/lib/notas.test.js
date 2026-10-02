import { describe, expect, it } from 'vitest'
import { normalizarNotas, notasImpresion, tieneNotas } from './notas'

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

describe('notasImpresion', () => {
  const fila = {
    notas: 'Urgente para el evento',
    notas_proveedores: 'Imprenta Sur: solo paga contra entrega',
    notas_catalogo: 'Imprenta Sur · Resma carta: pedir sin cortar',
    notas_insumo: 'Usar papel reciclado',
  }
  it('devuelve las cuatro notas en orden: solicitud, proveedores, catálogo e insumo', () => {
    expect(notasImpresion(fila).map((n) => n.titulo)).toEqual([
      'Nota de la solicitud',
      'Notas de proveedores sugeridos',
      'Notas del insumo del proveedor',
      'Nota del insumo',
    ])
    expect(notasImpresion(fila)[0].texto).toBe('Urgente para el evento')
  })
  it('omite las vacías, nulas o solo espacios', () => {
    expect(notasImpresion({ notas: '  ', notas_proveedores: null, notas_catalogo: '', notas_insumo: 'x' })).toEqual([
      { titulo: 'Nota del insumo', texto: 'x' },
    ])
  })
  it('una fila sin notas da lista vacía', () => {
    expect(notasImpresion({})).toEqual([])
  })
})
