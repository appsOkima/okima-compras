import { describe, expect, it } from 'vitest'
import { secciones } from '../secciones'
import { esRolValido, puedeVerSeccion, rutaInicial, seccionesPermitidas } from './permisos'

describe('puedeVerSeccion', () => {
  it('productor: solicitudes, proveedores e insumos', () => {
    expect(seccionesPermitidas('productor')).toEqual(['/solicitudes', '/proveedores', '/insumos'])
    expect(puedeVerSeccion('productor', '/facturas')).toBe(false)
    expect(puedeVerSeccion('productor', '/boletas')).toBe(false)
  })

  it('contador: suma facturas y boletas, sin resumen ni centros de costo', () => {
    expect(puedeVerSeccion('contador', '/facturas')).toBe(true)
    expect(puedeVerSeccion('contador', '/boletas')).toBe(true)
    expect(puedeVerSeccion('contador', '/resumen')).toBe(false)
    expect(puedeVerSeccion('contador', '/centros-costo')).toBe(false)
  })

  it('admin: todas las secciones', () => {
    secciones.forEach(({ path }) => expect(puedeVerSeccion('admin', path)).toBe(true))
  })

  it('rol desconocido, vacío o sin rol: sin acceso', () => {
    for (const rol of ['gerente', '', null, undefined]) {
      expect(puedeVerSeccion(rol, '/solicitudes')).toBe(false)
      expect(seccionesPermitidas(rol)).toEqual([])
    }
  })

  it('acepta subrutas de una sección permitida', () => {
    expect(puedeVerSeccion('productor', '/solicitudes/todas')).toBe(true)
    expect(puedeVerSeccion('productor', '/facturas/nueva')).toBe(false)
  })

  it('no confunde prefijos parecidos', () => {
    expect(puedeVerSeccion('productor', '/solicitudes-x')).toBe(false)
  })
})

describe('rutaInicial', () => {
  it('es la primera sección permitida del rol', () => {
    expect(rutaInicial('productor')).toBe('/solicitudes')
    expect(rutaInicial('admin')).toBe('/solicitudes')
  })

  it('rol desconocido: null', () => {
    expect(rutaInicial('x')).toBeNull()
  })
})

describe('esRolValido', () => {
  it('distingue los tres roles de lo demás', () => {
    expect(['productor', 'contador', 'admin'].every(esRolValido)).toBe(true)
    expect(esRolValido('Admin')).toBe(false)
    expect(esRolValido('toString')).toBe(false)
    expect(esRolValido(null)).toBe(false)
  })
})
