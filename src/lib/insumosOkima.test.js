import { describe, expect, it } from 'vitest'
import { opcionesInsumosOkima, valoresNuevoInsumo } from './insumosOkima'

describe('valoresNuevoInsumo', () => {
  it('limpia espacios y devuelve solo nombre y subcategoría', () => {
    expect(valoresNuevoInsumo({ nombre: '  Tazón   blanco ', id_subcategoria: 's1' })).toEqual({
      error: null,
      valores: { nombre: 'Tazón blanco', id_subcategoria: 's1' },
    })
  })
  it('exige nombre y subcategoría', () => {
    expect(valoresNuevoInsumo({ nombre: '   ', id_subcategoria: 's1' }).error).toMatch(/nombre/i)
    expect(valoresNuevoInsumo({ nombre: 'Tazón', id_subcategoria: '' }).error).toMatch(/subcategoría/i)
  })
})

describe('opcionesInsumosOkima', () => {
  const insumos = [
    { id: 'a', nombre: 'Tazón', subcategoria: { nombre: 'Cocina' } },
    { id: 'b', nombre: 'Resma' },
  ]
  it('arma opciones con detalle de subcategoría', () => {
    expect(opcionesInsumosOkima(insumos)).toEqual([
      { valor: 'a', etiqueta: 'Tazón', detalle: 'Cocina' },
      { valor: 'b', etiqueta: 'Resma', detalle: undefined },
    ])
  })
  it('omite los excluidos salvo el conservado', () => {
    expect(opcionesInsumosOkima(insumos, new Set(['a', 'b']), 'b').map((o) => o.valor)).toEqual(['b'])
  })
})
