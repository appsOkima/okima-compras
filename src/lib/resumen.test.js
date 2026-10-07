import { describe, expect, it } from 'vitest'
import { movimientos, movimientosDePago, repartirMonto } from './resumen'

const vinculo = (idSubcategoria) => ({ insumo: { id_subcategoria: idSubcategoria } })
const linea = (vinculos, subtotal = 100) => ({ subtotal, insumo_proveedor: { vinculos } })

const pagoFactura = (extra = {}, factura = {}) => ({
  monto: 119,
  fecha_pago: '2026-10-05',
  id_factura: 'f1',
  id_boleta: null,
  factura: { id: 'f1', estado_documento: 'vigente', total: 119, lineas: [], ...factura },
  boleta: null,
  ...extra,
})

const pagoBoleta = (extra = {}, boleta = {}) => ({
  monto: 50,
  fecha_pago: '2026-10-06',
  id_factura: null,
  id_boleta: 'b1',
  factura: null,
  boleta: { id: 'b1', estado_documento: 'vigente', id_subcategoria: 's1', ...boleta },
  ...extra,
})

describe('movimientos: el resumen suma pagos', () => {
  it('suma pagos de facturas y de boletas vigentes', () => {
    const lista = movimientos([pagoFactura(), pagoBoleta()])
    expect(lista.map((m) => [m.origen, m.monto])).toEqual([
      ['factura', 119],
      ['boleta', 50],
    ])
  })

  it('deja fuera los pagos de documentos anulados', () => {
    const lista = movimientos([
      pagoFactura(),
      pagoFactura({ monto: 999 }, { estado_documento: 'anulado' }),
      pagoBoleta({ monto: 777 }, { estado_documento: 'anulado' }),
      pagoBoleta(),
    ])
    expect(lista.reduce((s, m) => s + m.monto, 0)).toBe(169)
  })

  it('un pago sin documento embebido no suma', () => {
    expect(movimientos([{ monto: 10, fecha_pago: '2026-10-01', id_factura: 'f9', factura: null }])).toEqual([])
  })

  it('sin pagos no hay movimientos', () => {
    expect(movimientos(undefined)).toEqual([])
  })
})

describe('movimientosDePago: boleta', () => {
  it('va entera a la subcategoría de la boleta', () => {
    expect(movimientosDePago(pagoBoleta())).toEqual([
      { mes: '2026-10', origen: 'boleta', idSubcategoria: 's1', monto: 50 },
    ])
  })
  it('sin subcategoría queda sin centro de costo', () => {
    expect(movimientosDePago(pagoBoleta({}, { id_subcategoria: null }))[0].idSubcategoria).toBeNull()
  })
})

describe('movimientosDePago: factura', () => {
  it('pago total con dos líneas de distinta subcategoría se reparte por subtotal', () => {
    const p = pagoFactura(
      { monto: 119 },
      { lineas: [linea([vinculo('s1')], 75), linea([vinculo('s2')], 25)] },
    )
    expect(movimientosDePago(p).map((m) => [m.idSubcategoria, m.monto])).toEqual([
      ['s1', 89],
      ['s2', 30],
    ])
  })

  it('un pago parcial se prorratea con las mismas proporciones', () => {
    const f = { lineas: [linea([vinculo('s1')], 75), linea([vinculo('s2')], 25)] }
    const lista = movimientosDePago(pagoFactura({ monto: 40 }, f))
    expect(lista.map((m) => [m.idSubcategoria, m.monto])).toEqual([
      ['s1', 30],
      ['s2', 10],
    ])
  })

  it('varios pagos de la misma factura cuentan cada uno en el mes de su fecha_pago', () => {
    const f = { lineas: [linea([vinculo('s1')], 100)] }
    const lista = movimientos([
      pagoFactura({ monto: 60, fecha_pago: '2026-09-30' }, f),
      pagoFactura({ monto: 59, fecha_pago: '2026-11-01' }, f),
    ])
    expect(lista.map((m) => [m.mes, m.monto])).toEqual([
      ['2026-09', 60],
      ['2026-11', 59],
    ])
  })

  it('el mes es el del pago, no el de la fecha de la factura', () => {
    const p = pagoFactura({ fecha_pago: '2026-12-02' }, { fecha: '2026-08-15', lineas: [linea([vinculo('s1')])] })
    expect(movimientosDePago(p)[0].mes).toBe('2026-12')
  })

  it('la suma del reparto es exactamente el monto del pago', () => {
    const f = { lineas: [linea([vinculo('s1')], 1), linea([vinculo('s2')], 1), linea([vinculo('s3')], 1)] }
    const lista = movimientosDePago(pagoFactura({ monto: 100 }, f))
    expect(lista.reduce((s, m) => s + m.monto, 0)).toBe(100)
    expect(lista.map((m) => m.monto)).toEqual([34, 33, 33])
  })

  it('sin líneas, todo el pago queda sin centro de costo', () => {
    expect(movimientosDePago(pagoFactura({ monto: 80 }))).toEqual([
      { mes: '2026-10', origen: 'factura', idSubcategoria: null, monto: 80 },
    ])
  })

  it('con subtotales que suman 0, todo el pago queda sin centro de costo', () => {
    const lista = movimientosDePago(pagoFactura({ monto: 80 }, { lineas: [linea([vinculo('s1')], 0)] }))
    expect(lista.map((m) => [m.idSubcategoria, m.monto])).toEqual([[null, 80]])
  })

  it('usa el primer vínculo; sin vínculo o sin subcategoría queda sin centro de costo', () => {
    const f = {
      lineas: [
        linea([vinculo('s1'), vinculo('s2')], 100),
        linea([], 100),
        linea([{ insumo: null }], 100),
      ],
    }
    const lista = movimientosDePago(pagoFactura({ monto: 300 }, f))
    expect(lista.map((m) => m.idSubcategoria)).toEqual(['s1', null, null])
  })
})

describe('repartirMonto', () => {
  it('devuelve un solo movimiento sin centro si no hay líneas', () => {
    expect(repartirMonto(10, [])).toEqual([{ idSubcategoria: null, monto: 10 }])
  })
})
