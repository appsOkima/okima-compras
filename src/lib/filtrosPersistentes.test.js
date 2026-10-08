import { describe, expect, it } from 'vitest'
import { crearAlmacenBusquedas, seccionDe } from './filtrosPersistentes'

describe('seccionDe', () => {
  it('devuelve el primer segmento del pathname', () => {
    expect(seccionDe('/facturas')).toBe('/facturas')
    expect(seccionDe('/facturas/lineas')).toBe('/facturas')
    expect(seccionDe('/proveedores/catalogo/abc-123')).toBe('/proveedores')
  })

  it('el inicio queda como su propia sección', () => {
    expect(seccionDe('/')).toBe('/')
    expect(seccionDe('')).toBe('/')
  })
})

describe('almacén de búsquedas', () => {
  it('lee vacío lo que no se ha escrito y devuelve lo escrito por clave', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.alNavegar('/facturas')
    expect(almacen.leer('/facturas')).toBe('')
    almacen.escribir('/facturas', 'walter')
    expect(almacen.leer('/facturas')).toBe('walter')
  })

  it('cada vista (pathname) tiene su propio texto', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.alNavegar('/facturas')
    almacen.escribir('/facturas', 'walter')
    almacen.escribir('/facturas/lineas', 'scotch')
    expect(almacen.leer('/facturas')).toBe('walter')
    expect(almacen.leer('/facturas/lineas')).toBe('scotch')
  })

  it('moverse dentro de la misma sección conserva los textos', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.alNavegar('/facturas')
    almacen.escribir('/facturas', 'walter')
    almacen.alNavegar('/facturas/abc/detalle')
    almacen.alNavegar('/facturas/abc')
    almacen.alNavegar('/facturas/lineas')
    almacen.alNavegar('/facturas')
    expect(almacen.leer('/facturas')).toBe('walter')
  })

  it('cambiar de sección vacía todo el almacén', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.alNavegar('/facturas')
    almacen.escribir('/facturas', 'walter')
    almacen.escribir('/facturas/lineas', 'scotch')
    almacen.alNavegar('/boletas')
    expect(almacen.leer('/facturas')).toBe('')
    expect(almacen.leer('/facturas/lineas')).toBe('')
  })

  it('volver a la sección tras pasar por otra empieza vacío', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.alNavegar('/facturas')
    almacen.escribir('/facturas', 'walter')
    almacen.alNavegar('/pagos')
    almacen.alNavegar('/facturas')
    expect(almacen.leer('/facturas')).toBe('')
  })

  it('el primer pathname no vacía lo escrito antes de navegar', () => {
    const almacen = crearAlmacenBusquedas()
    almacen.escribir('/facturas', 'walter')
    almacen.alNavegar('/facturas')
    expect(almacen.leer('/facturas')).toBe('walter')
  })
})
