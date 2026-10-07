import { describe, expect, it } from 'vitest'
import {
  estaAnulado,
  motivoValido,
  resumenAnulacion,
  solicitudesVinculadas,
  textoAnulacion,
  vigentes,
} from './anulacion'

describe('estaAnulado / vigentes', () => {
  it('solo estado_documento = anulado cuenta como anulado', () => {
    expect(estaAnulado({ estado_documento: 'anulado' })).toBe(true)
    expect(estaAnulado({ estado_documento: 'vigente' })).toBe(false)
    expect(estaAnulado({})).toBe(false)
    expect(estaAnulado(null)).toBe(false)
  })

  it('vigentes deja fuera los anulados (y tolera null)', () => {
    const filas = [{ id: 1, estado_documento: 'vigente' }, { id: 2, estado_documento: 'anulado' }, { id: 3 }]
    expect(vigentes(filas).map((f) => f.id)).toEqual([1, 3])
    expect(vigentes(null)).toEqual([])
  })
})

describe('motivoValido', () => {
  it('exige texto con contenido', () => {
    expect(motivoValido('Duplicada')).toBe(true)
    expect(motivoValido('   ')).toBe(false)
    expect(motivoValido('')).toBe(false)
    expect(motivoValido(null)).toBe(false)
  })
})

describe('resumenAnulacion', () => {
  it('anular: stock revertido, fuera de totales y del Resumen', () => {
    const texto = resumenAnulacion('factura', 'anular')
    expect(texto).toContain('se revierte el stock sumado por sus líneas')
    expect(texto).toContain('deja de contar en totales y en el Resumen')
    expect(texto).toContain('factura')
  })

  it('reactivar: vuelve a sumar stock y a contar', () => {
    const texto = resumenAnulacion('boleta', 'reactivar')
    expect(texto).toContain('vuelve a sumar')
    expect(texto).toContain('vuelve a contar')
    expect(texto).toContain('boleta')
  })
})

describe('solicitudesVinculadas', () => {
  const linea = (id, insumo, solicitante, estado) => ({
    solicitud: { id, estado, solicitante, insumo: { nombre: insumo } },
  })

  it('lista cada solicitud una sola vez y se salta las líneas sin solicitud', () => {
    const lista = solicitudesVinculadas([
      linea('s1', 'Papel', 'Ana', 'Comprada'),
      { solicitud: null },
      linea('s1', 'Papel', 'Ana', 'Comprada'),
      linea('s2', 'Tinta', 'Luis', 'Pendiente'),
    ])
    expect(lista).toEqual(['Papel (Ana, Comprada)', 'Tinta (Luis, Pendiente)'])
  })

  it('una solicitud en estado Cancelada se muestra como Anulada', () => {
    expect(solicitudesVinculadas([linea('s1', 'Papel', 'Ana', 'Cancelada')])).toEqual(['Papel (Ana, Anulada)'])
  })

  it('sin líneas, vacío', () => {
    expect(solicitudesVinculadas(null)).toEqual([])
  })
})

describe('textoAnulacion', () => {
  it('fecha, quién y motivo', () => {
    const doc = {
      estado_documento: 'anulado',
      anulado_at: '2026-10-05T15:00:00Z',
      perfil_anulo: { nombre_mostrar: 'Carla' },
      motivo_anulacion: 'Factura duplicada',
    }
    expect(textoAnulacion(doc)).toMatch(/^Anulada el 0[45]-10-2026 por Carla\. Motivo: Factura duplicada$/)
  })

  it('omite lo que falte', () => {
    expect(textoAnulacion({ estado_documento: 'anulado' })).toBe('Anulada.')
    expect(textoAnulacion({ estado_documento: 'anulado', motivo_anulacion: 'Error' })).toBe('Anulada. Motivo: Error')
  })
})
