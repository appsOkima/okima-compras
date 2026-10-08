import { describe, expect, it } from 'vitest'
import { buscarEnFactura } from './busquedaFacturas'

const linea = (nombre, { codigo = null, okima = [] } = {}) => ({
  insumo_proveedor: { nombre, codigo, vinculos: okima.map((n) => ({ insumo: { nombre: n } })) },
})
const factura = (extra) => ({
  numero_factura: 'F-100',
  proveedor: { nombre: 'Papelera Walter Lund', rut: '76.123.456-7' },
  lineas: [linea('Couche brillante 150 g'), linea('Cartulina Opalina', { codigo: 'OP-30' })],
  ...extra,
})

describe('buscarEnFactura', () => {
  it('sin filtro deja pasar todo y no marca coincidencias de línea', () => {
    expect(buscarEnFactura(factura(), '')).toEqual({ coincide: true, lineas: [] })
    expect(buscarEnFactura(factura(), '   ')).toEqual({ coincide: true, lineas: [] })
  })

  it('sigue buscando por número de factura, proveedor y RUT', () => {
    expect(buscarEnFactura(factura(), 'f-100').coincide).toBe(true)
    expect(buscarEnFactura(factura(), 'walter').coincide).toBe(true)
    // El RUT se busca con o sin puntos y guion (como hacía el listado antes de buscar en líneas).
    expect(buscarEnFactura(factura(), '76.123').coincide).toBe(true)
    expect(buscarEnFactura(factura(), '761234567').coincide).toBe(true)
  })

  it('encuentra la factura por el nombre del insumo de una de sus líneas', () => {
    const r = buscarEnFactura(factura(), 'couche')
    expect(r.coincide).toBe(true)
    expect(r.lineas).toEqual(['Couche brillante 150 g'])
  })

  it('ignora mayúsculas y tildes', () => {
    expect(buscarEnFactura(factura(), 'COUCHÉ').coincide).toBe(true)
  })

  it('busca también por el código del insumo del proveedor y por el insumo Okima vinculado', () => {
    expect(buscarEnFactura(factura(), 'op-30').lineas).toEqual(['Cartulina Opalina'])
    const f = factura({ lineas: [linea('Resma Chamex', { okima: ['Papel carta'] })] })
    expect(buscarEnFactura(f, 'papel carta')).toEqual({ coincide: true, lineas: ['Resma Chamex'] })
  })

  it('no repite líneas con el mismo nombre y no inventa coincidencias', () => {
    const f = factura({ lineas: [linea('Couche 150'), linea('Couche 150')] })
    expect(buscarEnFactura(f, 'couche').lineas).toEqual(['Couche 150'])
    expect(buscarEnFactura(factura(), 'tinta')).toEqual({ coincide: false, lineas: [] })
  })

  it('si la cabecera ya coincide no lista líneas (evita ruido)', () => {
    const f = factura({ proveedor: { nombre: 'Couche Hnos', rut: '1-9' } })
    expect(buscarEnFactura(f, 'couche')).toEqual({ coincide: true, lineas: [] })
  })

  it('tolera facturas sin líneas, líneas sin insumo y vínculos incompletos', () => {
    expect(buscarEnFactura(factura({ lineas: undefined }), 'couche')).toEqual({ coincide: false, lineas: [] })
    expect(buscarEnFactura(factura({ lineas: [{ insumo_proveedor: null }, {}] }), 'couche').coincide).toBe(false)
    expect(buscarEnFactura(factura({ lineas: [{ insumo_proveedor: { nombre: 'X', vinculos: [{ insumo: null }] } }] }), 'x').coincide).toBe(true)
  })
})
