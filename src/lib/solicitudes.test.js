import { describe, expect, it } from 'vitest'
import { accionEstado, claseEstado, etiquetaEstado, textoConfirmacionEstado } from './solicitudes'

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
