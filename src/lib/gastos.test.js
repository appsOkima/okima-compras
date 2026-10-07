import { describe, expect, it } from 'vitest'
import { sumaCampo, sumaMontos } from './gastos'

describe('sumaMontos / sumaCampo', () => {
  it('suma monto e ignora vacíos y no numéricos', () => {
    expect(sumaMontos([{ monto: '1000' }, { monto: 500 }, { monto: null }, { monto: 'x' }, { monto: '' }])).toBe(1500)
    expect(sumaMontos(null)).toBe(0)
  })

  it('no cuenta los documentos anulados', () => {
    const filas = [{ monto: 1000 }, { monto: 400, estado_documento: 'anulado' }, { monto: 100, estado_documento: 'vigente' }]
    expect(sumaMontos(filas)).toBe(1100)
  })

  it('sumaCampo suma cualquier columna (total, iva) sin los anulados', () => {
    const filas = [
      { total: 119, iva: 19 },
      { total: 238, iva: 38, estado_documento: 'anulado' },
      { total: '119', iva: '19', estado_documento: 'vigente' },
    ]
    expect(sumaCampo(filas, 'total')).toBe(238)
    expect(sumaCampo(filas, 'iva')).toBe(38)
  })
})
