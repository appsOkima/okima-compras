import { describe, expect, it } from 'vitest'
import { secciones } from '../secciones'
import {
  esRolValido,
  puedeAnular,
  puedeBorrarPago,
  puedeEditarPago,
  puedeHacer,
  puedeReactivar,
  puedeRegistrarPago,
  puedeVerSeccion,
  rutaInicial,
  seccionesPermitidas,
} from './permisos'

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

describe('permisos de pagos (Sprint2 §2.1: contador CR, admin CRUD, productor nada)', () => {
  it('registran pagos contador y admin; productor no', () => {
    expect(puedeRegistrarPago('contador')).toBe(true)
    expect(puedeRegistrarPago('admin')).toBe(true)
    expect(puedeRegistrarPago('productor')).toBe(false)
  })

  it('editan y borran pagos solo el admin', () => {
    for (const permiso of [puedeEditarPago, puedeBorrarPago]) {
      expect(permiso('admin')).toBe(true)
      expect(permiso('contador')).toBe(false)
      expect(permiso('productor')).toBe(false)
    }
  })

  it('rol desconocido, vacío o sin rol: ninguno', () => {
    for (const rol of ['gerente', 'Admin', '', null, undefined]) {
      expect(puedeRegistrarPago(rol)).toBe(false)
      expect(puedeEditarPago(rol)).toBe(false)
      expect(puedeBorrarPago(rol)).toBe(false)
    }
  })

  it('la sección /pagos es solo del admin', () => {
    expect(puedeVerSeccion('admin', '/pagos')).toBe(true)
    expect(puedeVerSeccion('contador', '/pagos')).toBe(false)
    expect(puedeVerSeccion('productor', '/pagos')).toBe(false)
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

// Matriz de la migración T3b (rls-por-rol): C=crear, U=editar, D=borrar por entidad y rol.
const MATRIZ = {
  solicitudes: { productor: 'CU', contador: 'CU', admin: 'CUD' },
  proveedores: { productor: '', contador: 'CU', admin: 'CUD' },
  catalogo: { productor: '', contador: 'CU', admin: 'CUD' },
  insumos: { productor: 'CU', contador: 'CU', admin: 'CUD' },
  vinculos: { productor: 'CU', contador: 'CUD', admin: 'CUD' },
  facturas: { productor: '', contador: 'CU', admin: 'CUD' },
  boletas: { productor: '', contador: 'CU', admin: 'CUD' },
  plantillas: { productor: '', contador: '', admin: 'CUD' },
  categorias: { productor: '', contador: '', admin: 'CUD' },
  subcategorias: { productor: '', contador: '', admin: 'CUD' },
}
const LETRA = { crear: 'C', editar: 'U', borrar: 'D' }

describe('puedeHacer', () => {
  for (const [entidad, porRol] of Object.entries(MATRIZ)) {
    for (const [rol, letras] of Object.entries(porRol)) {
      it(`${entidad} / ${rol}: ${letras || 'nada'}`, () => {
        for (const accion of Object.keys(LETRA)) {
          expect(puedeHacer(rol, entidad, accion)).toBe(letras.includes(LETRA[accion]))
        }
      })
    }
  }

  it('rol desconocido, vacío o sin rol: nada', () => {
    for (const rol of ['gerente', 'Admin', '', null, undefined]) {
      for (const entidad of Object.keys(MATRIZ)) {
        for (const accion of Object.keys(LETRA)) expect(puedeHacer(rol, entidad, accion)).toBe(false)
      }
    }
  })

  it('entidad o acción desconocida: nada, incluso para admin', () => {
    expect(puedeHacer('admin', 'pagos', 'crear')).toBe(false)
    expect(puedeHacer('admin', 'solicitudes', 'leer')).toBe(false)
    expect(puedeHacer('admin', 'toString', 'crear')).toBe(false)
  })
})
