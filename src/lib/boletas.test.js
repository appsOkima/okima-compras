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
  it('parte con cantidad 1 y sin insumo', () => {
    expect(lineaBoletaVacia('x')).toMatchObject({ clave: 'x', descripcion: '', id_insumo_proveedor: '', cantidad: '1', precio: '' })
  })

  it('desde la base pasa a texto editable', () => {
    expect(
      lineaBoletaDesdeBase({ id: 'l1', descripcion: 'Taza', id_insumo_proveedor: null, cantidad: '2.5', precio: '1500.00' }),
    ).toEqual({ clave: 'l1', id: 'l1', descripcion: 'Taza', id_insumo_proveedor: '', cantidad: '2,5', precio: '1.500' })
  })

  it('datosLineaBoleta convierte, recorta y calcula el subtotal', () => {
    expect(datosLineaBoleta(linea({ descripcion: '  Luz ', cantidad: '2', precio: '1.500', id: 'l1' }))).toEqual({
      id: 'l1',
      descripcion: 'Luz',
      id_insumo_proveedor: null,
      cantidad: 2,
      precio: 1500,
      subtotal: 3000,
    })
    expect(datosLineaBoleta(linea({ id_insumo_proveedor: 'ip1' })).id_insumo_proveedor).toBe('ip1')
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
    concepto: ' Arriendo octubre ',
    id_subcategoria: 's1',
    id_proveedor: '',
    fecha: '2026-10-01',
    numero_documento: '',
    notas: ' ',
  }

  it('monto = suma de subtotales; vacíos quedan null', () => {
    expect(datosBoleta(cabecera, [linea(), linea({ cantidad: '2', precio: '500' })])).toEqual({
      concepto: 'Arriendo octubre',
      id_subcategoria: 's1',
      id_proveedor: null,
      fecha: '2026-10-01',
      numero_documento: null,
      notas: null,
      monto: 2000,
    })
  })

  it('erroresBoleta exige concepto y fecha', () => {
    expect(erroresBoleta(datosBoleta(cabecera, [linea()]))).toEqual({})
    expect(erroresBoleta(datosBoleta({ ...cabecera, concepto: ' ', fecha: '' }, [linea()]))).toEqual({
      concepto: 'Obligatorio.',
      fecha: 'Obligatoria.',
    })
  })
})

describe('diffLineasBoleta', () => {
  const originales = [
    { id: 'a', descripcion: 'Luz', id_insumo_proveedor: null, cantidad: '1', precio: '1000', subtotal: '1000' },
    { id: 'b', descripcion: 'Agua', id_insumo_proveedor: 'ip1', cantidad: '2.5', precio: '400', subtotal: '1000' },
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
      insertar: [{ descripcion: 'Gas', id_insumo_proveedor: null, cantidad: 1, precio: 300, subtotal: 300 }],
    })
  })
})

describe('valoresDesdePlantilla', () => {
  it('pre-llena concepto, subcategoría y una línea con el monto por defecto', () => {
    const v = valoresDesdePlantilla({ nombre: 'Arriendo', id_subcategoria: 's1', monto_default: '450000' }, 'k1')
    expect(v.cabecera).toMatchObject({ concepto: 'Arriendo', id_subcategoria: 's1' })
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
