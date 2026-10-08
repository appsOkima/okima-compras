import { describe, expect, it } from 'vitest'
import {
  datosBoleta,
  datosLineaBoleta,
  diffLineasBoleta,
  erroresBoleta,
  erroresLineaBoleta,
  lineaBoletaDesdeBase,
  lineaBoletaVacia,
  subtotalDeBoleta,
  totalBoleta,
  valoresDesdePlantilla,
} from './boletas'

const linea = (extra) => ({ ...lineaBoletaVacia('c1'), descripcion: 'Arriendo', precio: '1.000', ...extra })

describe('subtotal y total de boleta', () => {
  it('subtotal = cantidad × precio redondeado al peso, con coma decimal', () => {
    expect(subtotalDeBoleta({ cantidad: '2,5', precio: '1.001' })).toBe(2503)
    expect(subtotalDeBoleta({ cantidad: '3', precio: '1,1' })).toBe(3)
  })

  it('sin cantidad o precio no hay subtotal', () => {
    expect(subtotalDeBoleta({ cantidad: '', precio: '100' })).toBeNull()
    expect(subtotalDeBoleta({ cantidad: '1', precio: '' })).toBeNull()
  })

  it('el total suma los subtotales y cuenta 0 las líneas incompletas', () => {
    expect(totalBoleta([linea(), linea({ cantidad: '2', precio: '500' }), linea({ precio: '' })])).toBe(2000)
    expect(totalBoleta([])).toBe(0)
  })
})

describe('línea de boleta', () => {
  it('parte con cantidad 1, sin solicitud y sin insumo del proveedor', () => {
    const vacia = lineaBoletaVacia('x')
    expect(vacia).toMatchObject({ clave: 'x', descripcion: '', cantidad: '1', precio: '' })
    expect(vacia).not.toHaveProperty('id_insumo_proveedor')
  })

  it('desde la base pasa a texto editable', () => {
    expect(
      lineaBoletaDesdeBase({ id: 'l1', descripcion: 'Taza', cantidad: '2.5', precio: '1500.00' }),
    ).toEqual({
      clave: 'l1',
      id: 'l1',
      descripcion: 'Taza',
      id_solicitud_compra: '',
      cantidad: '2,5',
      precio: '1.500',
    })
  })

  it('la solicitud vinculada va y viene de la base; vacía es null', () => {
    expect(lineaBoletaDesdeBase({ id: 'l1', id_solicitud_compra: 's1', cantidad: 1, precio: 1 }).id_solicitud_compra).toBe('s1')
    expect(lineaBoletaVacia('x').id_solicitud_compra).toBe('')
    expect(datosLineaBoleta(linea({ id_solicitud_compra: 's1' })).id_solicitud_compra).toBe('s1')
    expect(datosLineaBoleta(linea()).id_solicitud_compra).toBeNull()
  })

  it('cambiar la solicitud de una línea guardada entra en el diff', () => {
    const original = { id: 'l1', descripcion: 'Arriendo', id_solicitud_compra: null, cantidad: 1, precio: 1000, subtotal: 1000 }
    const actual = datosLineaBoleta(linea({ id: 'l1', id_solicitud_compra: 's1' }))
    expect(diffLineasBoleta([original], [actual]).actualizar).toEqual([{ id: 'l1', datos: { id_solicitud_compra: 's1' } }])
  })

  it('datosLineaBoleta convierte, recorta y calcula el subtotal', () => {
    expect(datosLineaBoleta(linea({ descripcion: '  Luz ', cantidad: '2', precio: '1.500', id: 'l1' }))).toEqual({
      id: 'l1',
      descripcion: 'Luz',
      id_solicitud_compra: null,
      cantidad: 2,
      precio: 1500,
      subtotal: 3000,
    })
    expect(datosLineaBoleta(linea())).not.toHaveProperty('id_insumo_proveedor')
  })

  it('erroresLineaBoleta exige descripción, cantidad > 0 y precio > 0', () => {
    expect(erroresLineaBoleta(datosLineaBoleta(linea()))).toEqual({})
    expect(erroresLineaBoleta(datosLineaBoleta(linea({ descripcion: '  ', cantidad: '', precio: '' })))).toEqual({
      descripcion: 'Obligatoria.',
      cantidad: 'Obligatoria.',
      precio: 'Obligatorio.',
    })
    expect(erroresLineaBoleta(datosLineaBoleta(linea({ cantidad: '0', precio: '0' })))).toEqual({
      cantidad: 'Debe ser mayor que 0.',
      precio: 'Debe ser mayor que 0.',
    })
  })
})

describe('cabecera de boleta', () => {
  const cabecera = {
    id_subcategoria: 's1',
    id_proveedor: '',
    fecha: '2026-10-01',
    numero_documento: '',
    notas: ' ',
  }

  it('monto = suma de subtotales; vacíos quedan null', () => {
    expect(datosBoleta(cabecera, [linea(), linea({ cantidad: '2', precio: '500' })])).toEqual({
      id_subcategoria: 's1',
      id_proveedor: null,
      fecha: '2026-10-01',
      numero_documento: null,
      notas: null,
      monto: 2000,
    })
  })

  it('la cabecera ya no lleva concepto, aunque venga en el objeto', () => {
    expect(datosBoleta({ ...cabecera, concepto: 'Viejo' }, [linea()])).not.toHaveProperty('concepto')
  })

  it('erroresBoleta exige solo la fecha', () => {
    expect(erroresBoleta(datosBoleta(cabecera, [linea()]))).toEqual({})
    expect(erroresBoleta(datosBoleta({ ...cabecera, fecha: '' }, [linea()]))).toEqual({
      fecha: 'Obligatoria.',
    })
  })
})

describe('diffLineasBoleta', () => {
  const originales = [
    { id: 'a', descripcion: 'Luz', cantidad: '1', precio: '1000', subtotal: '1000' },
    { id: 'b', descripcion: 'Agua', cantidad: '2.5', precio: '400', subtotal: '1000' },
  ]
  const editables = originales.map(lineaBoletaDesdeBase)

  it('sin cambios no hay nada que hacer', () => {
    expect(diffLineasBoleta(originales, editables.map(datosLineaBoleta))).toEqual({ eliminar: [], actualizar: [], insertar: [] })
  })

  it('envía solo lo cambiado, inserta las nuevas y borra las quitadas', () => {
    const actuales = [
      datosLineaBoleta({ ...editables[0], precio: '1.200' }),
      datosLineaBoleta(linea({ descripcion: 'Gas', precio: '300' })),
    ]
    expect(diffLineasBoleta(originales, actuales)).toEqual({
      eliminar: ['b'],
      actualizar: [{ id: 'a', datos: { precio: 1200, subtotal: 1200 } }],
      insertar: [{ descripcion: 'Gas', id_solicitud_compra: null, cantidad: 1, precio: 300, subtotal: 300 }],
    })
  })
})

describe('valoresDesdePlantilla', () => {
  it('pre-llena la subcategoría y una línea (descripción = nombre) con el monto por defecto', () => {
    const v = valoresDesdePlantilla({ nombre: 'Arriendo', id_subcategoria: 's1', monto_default: '450000' }, 'k1')
    expect(v.cabecera).toEqual({ id_subcategoria: 's1' })
    expect(v.lineas).toEqual([
      { ...lineaBoletaVacia('k1'), descripcion: 'Arriendo', cantidad: '1', precio: '450.000' },
    ])
  })

  it('monto 0 (semilla) deja el precio vacío; subcategoría ausente queda vacía', () => {
    const v = valoresDesdePlantilla({ nombre: 'IVA', id_subcategoria: null, monto_default: 0 }, 'k')
    expect(v.lineas[0].precio).toBe('')
    expect(v.cabecera.id_subcategoria).toBe('')
  })
})
