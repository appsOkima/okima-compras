import { describe, expect, it } from 'vitest'
import {
  accionEstado,
  boletasDeLineas,
  claseEstado,
  etiquetaEstado,
  facturasDeLineas,
  solicitudesDisponibles,
  textoConfirmacionEstado,
} from './solicitudes'

describe('Cancelada se muestra como Anulada', () => {
  it('etiquetaEstado traduce solo Cancelada', () => {
    expect(etiquetaEstado('Cancelada')).toBe('Anulada')
    expect(etiquetaEstado('Pendiente')).toBe('Pendiente')
    expect(etiquetaEstado('Comprada')).toBe('Comprada')
    expect(etiquetaEstado(undefined)).toBe('')
  })

  it('la acción que lleva a Cancelada se llama Anular', () => {
    expect(accionEstado('Cancelada')).toBe('Anular solicitud')
    expect(accionEstado('Comprada')).toBe('Marcar comprada')
  })

  it('la confirmación habla de anular y del estado actual como Anulada', () => {
    const texto = textoConfirmacionEstado({ insumo_nombre: 'Papel', estado: 'Pendiente' }, 'Cancelada')
    expect(texto).toContain('¿Anular la solicitud de "Papel"?')
    const desdeAnulada = textoConfirmacionEstado({ insumo_nombre: 'Papel', estado: 'Cancelada' }, 'Pendiente')
    expect(desdeAnulada).toContain("Hoy está 'Anulada'")
  })

  it('el color sigue siendo el de Cancelada (valor guardado sin cambios)', () => {
    expect(claseEstado('Cancelada')).toContain('slate')
  })
})

describe('avisos de documentos vinculados al cambiar el estado', () => {
  const sol = { insumo_nombre: 'Papel', estado: 'Comprada' }
  const linea = (id, concepto, fecha, numero) => ({ boleta: { id, concepto, fecha, numero_documento: numero } })

  it('boletasDeLineas: una por boleta, con número y fecha si existen', () => {
    const lista = boletasDeLineas([
      linea('b1', 'Ferretería', '2026-10-05', '88'),
      linea('b1', 'Ferretería', '2026-10-05', '88'),
      linea('b2', 'Taxi', null, null),
      { boleta: null },
    ])
    expect(lista).toEqual(['«Ferretería» N° 88 (05-10-2026)', '«Taxi»'])
    expect(boletasDeLineas(null)).toEqual([])
  })

  it('facturas y boletas se mencionan juntas y el vínculo se mantiene', () => {
    const solo = textoConfirmacionEstado(sol, 'Pendiente', [], ['«Taxi»'])
    expect(solo).toContain('la boleta «Taxi»')
    expect(solo).not.toContain('factura')
    const varias = textoConfirmacionEstado(sol, 'Cancelada', ['N° 1 de ACME'], ['«Taxi»', '«Luz»'])
    expect(varias).toContain('la factura N° 1 de ACME')
    expect(varias).toContain('las boletas «Taxi» y «Luz»')
    expect(varias).toContain('el vínculo se mantiene')
  })

  it('al pasar a Comprada no se menciona ningún documento', () => {
    expect(textoConfirmacionEstado(sol, 'Comprada', ['N° 1'], ['«Taxi»'])).not.toContain('asociada')
  })

  it('las facturas siguen listándose como antes', () => {
    expect(facturasDeLineas([{ factura: { numero_factura: '1', fecha: '2026-10-05', proveedor: { nombre: 'ACME' } } }])).toEqual([
      'N° 1 de ACME (05-10-2026)',
    ])
  })
})

describe('solicitudesDisponibles (exclusividad factura/boleta)', () => {
  const lista = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]
  const ids = (r) => r.map((s) => s.id)

  it('solicitud libre: se ofrece', () => {
    expect(ids(solicitudesDisponibles(lista, new Set(), []))).toEqual(['s1', 's2', 's3'])
  })

  it('ocupada por el otro tipo de documento: se excluye', () => {
    expect(ids(solicitudesDisponibles(lista, new Set(['s2']), []))).toEqual(['s1', 's3'])
  })

  it('vinculada a la línea o documento actual: se conserva aunque esté ocupada', () => {
    expect(ids(solicitudesDisponibles(lista, new Set(['s2', 's3']), ['s2']))).toEqual(['s1', 's2'])
  })

  it('lista vacía o ausente: vacío', () => {
    expect(solicitudesDisponibles([], new Set(['s1']), [])).toEqual([])
    expect(solicitudesDisponibles(undefined, undefined, undefined)).toEqual([])
  })
})
