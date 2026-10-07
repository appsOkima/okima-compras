import { describe, expect, it } from 'vitest'
import { solicitudesDisponibles } from './solicitudes'
import { lineaBoletaParaVincular, lineaFacturaParaVincular, lineasParaSolicitud, solicitudesParaModal } from './vinculacion'

const sol = (id, extra = {}) => ({
  id,
  id_insumo_okima: 'x',
  insumo_nombre: `Insumo ${id}`,
  solicitante: 'Ana',
  nivel_urgencia: 'Media',
  fecha_esperada: null,
  created_at: `2026-01-0${id}`,
  ...extra,
})
const ids = (filas) => filas.map((f) => f.solicitud.id)

describe('solicitudesParaModal', () => {
  it('pone primero las que coinciden con cualquiera de los insumos vinculados y las marca', () => {
    const r = solicitudesParaModal(
      [sol('1', { id_insumo_okima: 'z', nivel_urgencia: 'Alta' }), sol('2', { id_insumo_okima: 'b' }), sol('3', { id_insumo_okima: 'a' })],
      { idsInsumoOkima: ['a', 'b'] },
    )
    expect(ids(r)).toEqual(['2', '3', '1'])
    expect(r.map((f) => f.coincide)).toEqual([true, true, false])
  })

  it('dentro de cada grupo ordena por urgencia Alta, Media, Baja', () => {
    const r = solicitudesParaModal([
      sol('1', { nivel_urgencia: 'Baja' }),
      sol('2', { nivel_urgencia: 'Alta' }),
      sol('3', { nivel_urgencia: 'Media' }),
    ])
    expect(ids(r)).toEqual(['2', '3', '1'])
  })

  it('a igual urgencia ordena por fecha tope y deja las sin fecha al final', () => {
    const r = solicitudesParaModal([
      sol('1', { fecha_esperada: null }),
      sol('2', { fecha_esperada: '2026-03-01' }),
      sol('3', { fecha_esperada: '2026-02-01' }),
    ])
    expect(ids(r)).toEqual(['3', '2', '1'])
  })

  it('la coincidencia de insumo gana a la urgencia', () => {
    const r = solicitudesParaModal(
      [sol('1', { nivel_urgencia: 'Alta', id_insumo_okima: 'z' }), sol('2', { nivel_urgencia: 'Baja', id_insumo_okima: 'a' })],
      { idsInsumoOkima: ['a'] },
    )
    expect(ids(r)).toEqual(['2', '1'])
  })

  it('sin insumo en la línea no marca ninguna y ordena solo por urgencia y fecha', () => {
    const r = solicitudesParaModal([sol('1', { nivel_urgencia: 'Baja' }), sol('2', { nivel_urgencia: 'Alta' })], { idsInsumoOkima: [] })
    expect(ids(r)).toEqual(['2', '1'])
    expect(r.every((f) => f.coincide === false)).toBe(true)
  })

  it('el orden es estable: a igualdad total conserva el orden de entrada', () => {
    const iguales = ['a', 'b', 'c', 'd'].map((id) => sol(id, { created_at: '2026-01-01' }))
    expect(ids(solicitudesParaModal(iguales))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('busca por insumo o solicitante sin distinguir mayúsculas ni tildes', () => {
    const lista = [sol('1', { insumo_nombre: 'Cartón corrugado', solicitante: 'Pedro' }), sol('2', { insumo_nombre: 'Tinta', solicitante: 'Íñigo' })]
    expect(ids(solicitudesParaModal(lista, { busqueda: 'CARTON' }))).toEqual(['1'])
    expect(ids(solicitudesParaModal(lista, { busqueda: 'inigo' }))).toEqual(['2'])
    expect(solicitudesParaModal(lista, { busqueda: 'nada' })).toEqual([])
    expect(solicitudesParaModal(lista, { busqueda: '  ' })).toHaveLength(2)
  })

  it('excluye las elegidas en otras líneas del documento', () => {
    const r = solicitudesParaModal([sol('1'), sol('2'), sol('3')], { excluir: new Set(['2']) })
    expect(ids(r)).toEqual(['1', '3'])
  })

  it('con solicitudesDisponibles: las ocupadas por el otro tipo no salen, salvo las propias', () => {
    const base = solicitudesDisponibles([sol('1'), sol('2'), sol('3')], new Set(['1', '2']), ['2'])
    expect(ids(solicitudesParaModal(base, { excluir: ['3'] }))).toEqual(['2'])
  })

  it('no modifica la lista recibida ni falla con entradas vacías', () => {
    const lista = [sol('1', { nivel_urgencia: 'Baja' }), sol('2', { nivel_urgencia: 'Alta' })]
    solicitudesParaModal(lista)
    expect(lista.map((s) => s.id)).toEqual(['1', '2'])
    expect(solicitudesParaModal(undefined)).toEqual([])
  })
})

const filaFactura = (id, extra = {}) => ({
  id,
  cantidad: 2,
  subtotal: 1000,
  id_solicitud_compra: null,
  factura: { numero_factura: `F${id}`, fecha: '2026-02-10', estado_documento: 'vigente', proveedor: { nombre: 'Papelera Sur' } },
  insumo_proveedor: { nombre: 'Resma carta', vinculos: [{ id_insumo_okima: 'papel' }, { id_insumo_okima: 'carta' }] },
  ...extra,
})
const filaBoleta = (id, extra = {}) => ({
  id,
  descripcion: 'Scotch',
  cantidad: 1,
  subtotal: 500,
  id_solicitud_compra: null,
  boleta: { concepto: 'Ferretería', numero_documento: '77', fecha: '2026-02-12', estado_documento: 'vigente', proveedor: null },
  insumo_proveedor: null,
  ...extra,
})

describe('normalización de líneas', () => {
  it('línea de factura: documento, proveedor, insumos Okima y estado', () => {
    const l = lineaFacturaParaVincular(filaFactura('a'))
    expect(l).toMatchObject({
      tipo: 'factura',
      id: 'a',
      documento: 'Factura N° Fa',
      proveedor: 'Papelera Sur',
      descripcion: 'Resma carta',
      idsInsumoOkima: ['papel', 'carta'],
      anulado: false,
      idSolicitud: null,
    })
  })

  it('línea de boleta sin insumo ni proveedor y de documento anulado', () => {
    const l = lineaBoletaParaVincular(filaBoleta('b', { boleta: { concepto: 'Ferretería', fecha: '2026-02-12', estado_documento: 'anulado' } }))
    expect(l).toMatchObject({ tipo: 'boleta', documento: 'Boleta «Ferretería»', proveedor: '', descripcion: 'Scotch', idsInsumoOkima: [], anulado: true })
  })
})

describe('lineasParaSolicitud', () => {
  const solicitud = { id: 's', id_insumo_okima: 'papel' }
  const f = (id, extra) => lineaFacturaParaVincular(filaFactura(id, extra))
  const b = (id, extra) => lineaBoletaParaVincular(filaBoleta(id, extra))
  const idsL = (filas) => filas.map((x) => x.linea.id)

  it('solo ofrece líneas sin solicitud y de documentos vigentes', () => {
    const lineas = [
      f('1'),
      f('2', { id_solicitud_compra: 'otra' }),
      f('3', { factura: { numero_factura: '3', fecha: '2026-02-10', estado_documento: 'anulado' } }),
      b('4'),
    ]
    expect(idsL(lineasParaSolicitud(lineas, solicitud))).toEqual(['1', '4'])
  })

  it('prioriza las líneas cuyo insumo Okima coincide con el de la solicitud', () => {
    const lineas = [b('1'), f('2', { insumo_proveedor: { nombre: 'Otro', vinculos: [{ id_insumo_okima: 'tinta' }] } }), f('3')]
    const r = lineasParaSolicitud(lineas, solicitud)
    expect(idsL(r)).toEqual(['3', '1', '2'])
    expect(r[0].coincide).toBe(true)
    expect(r.slice(1).every((x) => !x.coincide)).toBe(true)
  })

  it('el resto va de la fecha más reciente a la más antigua y es estable', () => {
    const lineas = [
      b('1', { boleta: { concepto: 'A', fecha: '2026-01-01', estado_documento: 'vigente' } }),
      b('2', { boleta: { concepto: 'B', fecha: '2026-03-01', estado_documento: 'vigente' } }),
      b('3', { boleta: { concepto: 'C', fecha: '2026-03-01', estado_documento: 'vigente' } }),
    ]
    expect(idsL(lineasParaSolicitud(lineas, { id: 's', id_insumo_okima: 'q' }))).toEqual(['2', '3', '1'])
  })

  it('filtra por tipo', () => {
    const lineas = [f('1'), b('2')]
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { tipo: 'boleta' }))).toEqual(['2'])
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { tipo: 'factura' }))).toEqual(['1'])
  })

  it('busca por documento, proveedor, descripción o insumo sin distinguir tildes', () => {
    const lineas = [f('1'), b('2')]
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { busqueda: 'papelera' }))).toEqual(['1'])
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { busqueda: 'ferreteria' }))).toEqual(['2'])
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { busqueda: 'scotch' }))).toEqual(['2'])
    expect(idsL(lineasParaSolicitud(lineas, solicitud, { busqueda: 'F1' }))).toEqual(['1'])
    expect(lineasParaSolicitud(lineas, solicitud, { busqueda: 'zzz' })).toEqual([])
  })

  it('entradas vacías no fallan', () => {
    expect(lineasParaSolicitud(undefined, solicitud)).toEqual([])
  })
})
