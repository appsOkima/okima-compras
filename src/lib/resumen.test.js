import { describe, expect, it } from 'vitest'
import { movimientos, movimientosDeFactura } from './resumen'

describe('movimientos', () => {
  const factura = (extra) => ({ fecha: '2026-09-10', total: 119, lineas: [], ...extra })
  const boleta = (extra) => ({ fecha: '2026-09-11', monto: 50, id_subcategoria: 's1', ...extra })

  it('suma facturas y boletas vigentes', () => {
    const lista = movimientos([factura()], [boleta()])
    expect(lista.map((m) => [m.origen, m.monto])).toEqual([
      ['factura', 119],
      ['gasto', 50],
    ])
  })

  it('deja fuera facturas y boletas anuladas', () => {
    const lista = movimientos(
      [factura(), factura({ total: 999, estado_documento: 'anulado' })],
      [boleta({ monto: 777, estado_documento: 'anulado' }), boleta({ estado_documento: 'vigente' })],
    )
    expect(lista.reduce((s, m) => s + m.monto, 0)).toBe(169)
  })
})

describe('movimientosDeFactura: centro de costo desde los vínculos N:M', () => {
  const linea = (vinculos, subtotal = 100) => ({ subtotal, insumo_proveedor: { vinculos } })

  it('usa la subcategoría del insumo Okima vinculado al insumo del proveedor', () => {
    const f = { fecha: '2026-09-10', total: 100, lineas: [linea([{ insumo: { id_subcategoria: 's1' } }])] }
    expect(movimientosDeFactura(f)[0].idSubcategoria).toBe('s1')
  })
  it('con varios vínculos toma el primero', () => {
    const f = {
      fecha: '2026-09-10',
      total: 100,
      lineas: [linea([{ insumo: { id_subcategoria: 's1' } }, { insumo: { id_subcategoria: 's2' } }])],
    }
    expect(movimientosDeFactura(f)[0].idSubcategoria).toBe('s1')
  })
  it('sin vínculos o sin subcategoría queda sin centro de costo', () => {
    const f = { fecha: '2026-09-10', total: 100, lineas: [linea([]), linea([{ insumo: null }])] }
    expect(movimientosDeFactura(f).map((m) => m.idSubcategoria)).toEqual([null, null])
  })
})
