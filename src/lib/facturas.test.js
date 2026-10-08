import { describe, expect, it } from 'vitest'
import {
  aplicarCambioLinea,
  efectoStock,
  lineaVacia,
  ordenarSolicitudesParaLinea,
  stockQueSuma,
  vinculoPropuesto,
  vinculosAAplicar,
} from './facturas'

const catalogo = new Map([
  ['ip-libre', { id: 'ip-libre', nombre: 'Taza Sur', cantidad_formato: '6', vinculos: [] }],
  ['ip-sin-formato', { id: 'ip-sin-formato', nombre: 'Plato Sur', cantidad_formato: null, vinculos: [] }],
  [
    'ip-ok',
    { id: 'ip-ok', nombre: 'Taza Norte', vinculos: [{ id_insumo_okima: 'taza', factor_conversion: '1', insumo: { nombre: 'Taza' } }] },
  ],
  [
    'ip-otro',
    { id: 'ip-otro', nombre: 'Taza Este', vinculos: [{ id_insumo_okima: 'plato', factor_conversion: '1', insumo: { nombre: 'Plato' } }] },
  ],
])
const solicitudes = new Map([['s1', { id: 's1', id_insumo_okima: 'taza', insumo_nombre: 'Taza' }]])

const linea = (extra) => ({ ...lineaVacia('c1'), id_solicitud_compra: 's1', ...extra })

describe('vinculoPropuesto', () => {
  it('sin solicitud o sin insumo no hay nada que preguntar', () => {
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-libre', id_solicitud_compra: '' }), catalogo, solicitudes).tipo).toBe('ninguno')
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: '' }), catalogo, solicitudes).tipo).toBe('ninguno')
  })
  it('sin ningún vínculo propone vincular con el insumo de la solicitud y el factor por defecto', () => {
    const p = vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-libre' }), catalogo, solicitudes)
    expect(p).toMatchObject({ tipo: 'proponer', idInsumoOkima: 'taza', nombreInsumoOkima: 'Taza', factor: '6', decision: null })
  })
  it('el factor por defecto es 1 si no hay cantidad_formato, y el editado manda', () => {
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-sin-formato' }), catalogo, solicitudes).factor).toBe('1')
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-libre', factorVinculo: '2,5' }), catalogo, solicitudes).factor).toBe('2,5')
  })
  it('ya vinculado al insumo de la solicitud no pregunta nada', () => {
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-ok' }), catalogo, solicitudes).tipo).toBe('ninguno')
  })
  it('vinculado solo a otros insumos solo avisa, con sus nombres', () => {
    expect(vinculoPropuesto(linea({ id_insumo_proveedor: 'ip-otro' }), catalogo, solicitudes)).toMatchObject({
      tipo: 'ya-vinculado',
      nombreVinculado: 'Plato',
      nombreInsumoOkima: 'Taza',
    })
  })
  it('recoge la decisión del usuario', () => {
    const base = linea({ id_insumo_proveedor: 'ip-libre', vinculo: { acepta: true, idInsumoProveedor: 'ip-libre', idInsumoOkima: 'taza' } })
    expect(vinculoPropuesto(base, catalogo, solicitudes).decision).toBe('aceptado')
  })
})

describe('vinculosAAplicar', () => {
  const aceptada = (extra) =>
    linea({ id_insumo_proveedor: 'ip-libre', vinculo: { acepta: true, idInsumoProveedor: 'ip-libre', idInsumoOkima: 'taza' }, ...extra })

  it('aplica solo lo aceptado, con el factor numérico', () => {
    const r = vinculosAAplicar([aceptada({ factorVinculo: '2,5' })], catalogo, solicitudes)
    expect(r).toEqual([
      { idInsumoProveedor: 'ip-libre', idInsumoOkima: 'taza', factor: 2.5, nombreInsumoProveedor: 'Taza Sur', nombreInsumoOkima: 'Taza' },
    ])
  })
  it('usa el factor por defecto si no se editó', () => {
    expect(vinculosAAplicar([aceptada()], catalogo, solicitudes)[0].factor).toBe(6)
  })
  it('lo rechazado o sin decidir no se aplica', () => {
    const rechazada = linea({ id_insumo_proveedor: 'ip-libre', vinculo: { acepta: false, idInsumoProveedor: 'ip-libre', idInsumoOkima: 'taza' } })
    expect(vinculosAAplicar([rechazada, linea({ id_insumo_proveedor: 'ip-libre' })], catalogo, solicitudes)).toEqual([])
  })
  it('no aplica si el insumo del proveedor ya tiene vínculos', () => {
    const l = linea({ id_insumo_proveedor: 'ip-otro', vinculo: { acepta: true, idInsumoProveedor: 'ip-otro', idInsumoOkima: 'taza' } })
    expect(vinculosAAplicar([l], catalogo, solicitudes)).toEqual([])
  })
  it('un mismo par aceptado en dos líneas se aplica una sola vez (vale la primera)', () => {
    const r = vinculosAAplicar([aceptada({ clave: 'a', factorVinculo: '2' }), aceptada({ clave: 'b', factorVinculo: '9' })], catalogo, solicitudes)
    expect(r).toHaveLength(1)
    expect(r[0].factor).toBe(2)
  })
  it('un factor inválido queda en null para que el formulario lo rechace', () => {
    expect(vinculosAAplicar([aceptada({ factorVinculo: '' })], catalogo, solicitudes)[0].factor).toBeNull()
  })
})

describe('aplicarCambioLinea', () => {
  it('cambiar el insumo o la solicitud anula la decisión y el factor editado', () => {
    const l = linea({ id_insumo_proveedor: 'ip-libre', vinculo: { acepta: true }, factorVinculo: '3' })
    expect(aplicarCambioLinea(l, 'id_insumo_proveedor', 'ip-ok')).toMatchObject({ vinculo: null, factorVinculo: null })
  })
  it('editar el factor no anula la decisión', () => {
    const l = linea({ vinculo: { acepta: true } })
    expect(aplicarCambioLinea(l, 'factorVinculo', '4')).toMatchObject({ vinculo: { acepta: true }, factorVinculo: '4' })
  })
})

describe('stockQueSuma', () => {
  it('cantidad × factor', () => {
    expect(stockQueSuma('3', 2)).toBe(6)
    expect(stockQueSuma('2', '0.5')).toBe(1)
  })
  it('cantidad inválida da null', () => {
    expect(stockQueSuma('', 2)).toBeNull()
  })
})

describe('efectoStock', () => {
  const vinculos = [
    { nombre: 'Taza', factor: 2 },
    { nombre: 'Plato', factor: '0.5', pendiente: true },
  ]
  it('sin insumo del proveedor no hay aviso', () => {
    expect(efectoStock({ idInsumoProveedor: '', cantidad: '1', vinculos })).toBeNull()
  })
  it('línea nueva con vínculos: un movimiento por cada insumo Okima', () => {
    expect(efectoStock({ idInsumoProveedor: 'ip', cantidad: '4', vinculos })).toEqual({
      tipo: 'suma',
      movimientos: [
        { nombre: 'Taza', qty: 8, pendiente: false },
        { nombre: 'Plato', qty: 2, pendiente: true },
      ],
      revierte: [],
    })
  })
  it('línea nueva sin vínculos no suma', () => {
    expect(efectoStock({ idInsumoProveedor: 'ip', cantidad: '4', vinculos: [] })).toMatchObject({ tipo: 'sin-vinculo', revierte: [] })
  })
  const original = { id_insumo_proveedor: 'ip', cantidad: '4', movimientos: [{ qty: '8', insumo: { nombre: 'Taza' } }] }
  it('línea guardada sin cambios conserva lo aplicado', () => {
    expect(efectoStock({ idInsumoProveedor: 'ip', cantidad: '4', vinculos }, original)).toEqual({
      tipo: 'aplicado',
      movimientos: [{ qty: 8, nombre: 'Taza' }],
      revierte: [],
    })
  })
  it('línea guardada sin movimientos y sin cambios queda "no-aplicado"', () => {
    expect(efectoStock({ idInsumoProveedor: 'ip', cantidad: '4', vinculos }, { ...original, movimientos: [] })).toMatchObject({
      tipo: 'no-aplicado',
    })
  })
  it('si cambia la cantidad revierte lo aplicado y suma de nuevo', () => {
    const e = efectoStock({ idInsumoProveedor: 'ip', cantidad: '5', vinculos }, original)
    expect(e.tipo).toBe('suma')
    expect(e.revierte).toEqual([{ qty: 8, nombre: 'Taza' }])
  })
})

describe('ordenarSolicitudesParaLinea', () => {
  const s = (id, insumo) => ({ id, id_insumo_okima: insumo, nivel_urgencia: 'Media', created_at: id })
  it('pone primero las solicitudes de cualquiera de los insumos vinculados', () => {
    const r = ordenarSolicitudesParaLinea([s('1', 'x'), s('2', 'b'), s('3', 'a')], ['a', 'b'])
    expect(r.map((x) => x.id).slice(0, 2).sort()).toEqual(['2', '3'])
    expect(r[2].id).toBe('1')
  })
  it('sin insumos vinculados no descarta ninguna', () => {
    expect(ordenarSolicitudesParaLinea([s('1', 'x'), s('2', 'b')], [])).toHaveLength(2)
  })
})
