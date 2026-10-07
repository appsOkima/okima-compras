import { describe, expect, it } from 'vitest'
import { secciones } from '../secciones'
import { esRolValido, puedeAnular, puedeReactivar, puedeVerSeccion, rutaInicial, seccionesPermitidas } from './permisos'

describe('puedeAnular / puedeReactivar', () => {
  it('anulan contador y admin; productor no', () => {
    expect(puedeAnular('contador')).toBe(true)
    expect(puedeAnular('admin')).toBe(true)
    expect(puedeAnular('productor')).toBe(false)
  })

  it('reactiva solo el admin', () => {
    expect(puedeReactivar('admin')).toBe(true)
    expect(puedeReactivar('contador')).toBe(false)
    expect(puedeReactivar('productor')).toBe(false)
  })

  it('rol desconocido, vacío o sin rol: ninguna de las dos', () => {
    for (const rol of ['gerente', 'Admin', '', null, undefined]) {
      expect(puedeAnular(rol)).toBe(false)
      expect(puedeReactivar(rol)).toBe(false)
    }
  })
})

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
