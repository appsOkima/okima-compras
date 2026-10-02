import { describe, expect, it } from 'vitest'
import {
  cambiosVinculos,
  factorPorDefecto,
  textoMovimientos,
  textoVinculos,
  validarFactor,
  validarVinculos,
  vinculosEditables,
} from './vinculos'

describe('factorPorDefecto', () => {
  it('usa cantidad_formato si es mayor que 0 (número o texto de la base)', () => {
    expect(factorPorDefecto(12)).toBe(12)
    expect(factorPorDefecto('2.5')).toBe(2.5)
  })
  it('vacío, 0, negativo o inválido da 1', () => {
    expect(factorPorDefecto(null)).toBe(1)
    expect(factorPorDefecto(undefined)).toBe(1)
    expect(factorPorDefecto('')).toBe(1)
    expect(factorPorDefecto(0)).toBe(1)
    expect(factorPorDefecto(-3)).toBe(1)
    expect(factorPorDefecto('abc')).toBe(1)
  })
})

describe('validarFactor', () => {
  it('acepta números mayores que 0 con coma decimal', () => {
    expect(validarFactor('1')).toBeNull()
    expect(validarFactor('0,5')).toBeNull()
    expect(validarFactor('2.000')).toBeNull()
  })
  it('rechaza vacío, 0 y no numéricos', () => {
    expect(validarFactor('')).toMatch(/obligatorio/i)
    expect(validarFactor('0')).toMatch(/mayor que 0/i)
    expect(validarFactor('0,0')).toMatch(/mayor que 0/i)
    expect(validarFactor('abc')).toMatch(/obligatorio/i)
  })
})

describe('validarVinculos', () => {
  it('lista vacía es válida (insumo sin vincular)', () => {
    expect(validarVinculos([])).toBeNull()
    expect(validarVinculos(undefined)).toBeNull()
  })
  it('exige insumo Okima en cada fila', () => {
    expect(validarVinculos([{ id_insumo_okima: '', factor: '1' }])).toMatch(/insumo Okima/i)
  })
  it('exige un factor válido en cada fila', () => {
    expect(validarVinculos([{ id_insumo_okima: 'a', factor: '0' }])).toMatch(/factor/i)
  })
  it('no permite el mismo insumo Okima dos veces', () => {
    const filas = [
      { id_insumo_okima: 'a', factor: '1' },
      { id_insumo_okima: 'a', factor: '2' },
    ]
    expect(validarVinculos(filas)).toMatch(/más de una vez/i)
  })
  it('acepta varias filas distintas y válidas', () => {
    const filas = [
      { id_insumo_okima: 'a', factor: '1' },
      { id_insumo_okima: 'b', factor: '2,5' },
    ]
    expect(validarVinculos(filas)).toBeNull()
  })
})

describe('vinculosEditables', () => {
  it('convierte filas de la base a filas editables con factor en formato chileno', () => {
    const base = [{ id: 'p1', id_insumo_okima: 'a', factor_conversion: '2.5', insumo: { nombre: 'Taza' } }]
    expect(vinculosEditables(base)).toEqual([{ clave: 'p1', id: 'p1', id_insumo_okima: 'a', factor: '2,5' }])
  })
  it('sin filas o sin valor da lista vacía', () => {
    expect(vinculosEditables(undefined)).toEqual([])
    expect(vinculosEditables('')).toEqual([])
  })
})

describe('cambiosVinculos', () => {
  const originales = [
    { id: 'p1', id_insumo_okima: 'a', factor_conversion: '1' },
    { id: 'p2', id_insumo_okima: 'b', factor_conversion: '2.5' },
  ]
  const intactas = [
    { id: 'p1', id_insumo_okima: 'a', factor: '1' },
    { id: 'p2', id_insumo_okima: 'b', factor: '2,5' },
  ]
  it('sin cambios no hay nada que hacer (el factor de la base es texto con punto)', () => {
    expect(cambiosVinculos(originales, intactas)).toEqual({ insertar: [], actualizar: [], eliminar: [] })
  })
  it('inserta las filas nuevas con el factor como número', () => {
    const actuales = [...intactas, { clave: 'nueva-1', id_insumo_okima: 'c', factor: '3' }]
    expect(cambiosVinculos(originales, actuales).insertar).toEqual([{ id_insumo_okima: 'c', factor_conversion: 3 }])
  })
  it('actualiza solo los campos que cambiaron', () => {
    const actuales = [
      { id: 'p1', id_insumo_okima: 'a', factor: '4' },
      { id: 'p2', id_insumo_okima: 'z', factor: '2,5' },
    ]
    expect(cambiosVinculos(originales, actuales).actualizar).toEqual([
      { id: 'p1', datos: { factor_conversion: 4 } },
      { id: 'p2', datos: { id_insumo_okima: 'z' } },
    ])
  })
  it('borra las filas quitadas', () => {
    expect(cambiosVinculos(originales, [intactas[0]]).eliminar).toEqual(['p2'])
  })
  it('sin originales todo es inserción', () => {
    const actuales = [{ clave: 'n', id_insumo_okima: 'a', factor: '1' }]
    expect(cambiosVinculos(undefined, actuales)).toEqual({
      insertar: [{ id_insumo_okima: 'a', factor_conversion: 1 }],
      actualizar: [],
      eliminar: [],
    })
  })
})

describe('textoVinculos', () => {
  it('muestra "Insumo × factor" separados por coma', () => {
    const v = [
      { factor_conversion: '1', insumo: { nombre: 'Taza' } },
      { factor_conversion: '0.5', insumo: { nombre: 'Plato' } },
    ]
    expect(textoVinculos(v)).toBe('Taza × 1, Plato × 0,5')
  })
  it('sin vínculos devuelve vacío', () => {
    expect(textoVinculos([])).toBe('')
    expect(textoVinculos(undefined)).toBe('')
  })
})

describe('textoMovimientos', () => {
  it('muestra "+qty Insumo" de cada movimiento', () => {
    const m = [
      { qty: '12', insumo: { nombre: 'Taza' } },
      { qty: 0.5, insumo: { nombre: 'Plato' } },
    ]
    expect(textoMovimientos(m)).toBe('+12 Taza, +0,5 Plato')
  })
  it('sin movimientos devuelve vacío', () => {
    expect(textoMovimientos(null)).toBe('')
  })
})
