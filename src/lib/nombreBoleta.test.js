import { describe, expect, it } from 'vitest'
import { nombreBoleta } from './nombreBoleta'

const l = (descripcion, created_at, id) => ({ descripcion, created_at, id })

describe('nombreBoleta', () => {
  it('una línea: su descripción', () => {
    expect(nombreBoleta([l('Arriendo octubre', '2026-10-01T10:00:00Z', 'a')])).toBe('Arriendo octubre')
  })

  it('varias líneas: la más antigua más " (+N más)"', () => {
    const lineas = [l('Gas', '2026-10-01T10:00:02Z', 'c'), l('Luz', '2026-10-01T10:00:00Z', 'a'), l('Agua', '2026-10-01T10:00:01Z', 'b')]
    expect(nombreBoleta(lineas)).toBe('Luz (+2 más)')
  })

  it('desempata por id cuando created_at es igual', () => {
    const lineas = [l('Segunda', '2026-10-01T10:00:00Z', 'b'), l('Primera', '2026-10-01T10:00:00Z', 'a')]
    expect(nombreBoleta(lineas)).toBe('Primera (+1 más)')
  })

  it('no modifica la lista recibida y recorta espacios', () => {
    const lineas = [l('  Gas ', '2026-10-02', 'b'), l('Luz', '2026-10-01', 'a')]
    nombreBoleta(lineas)
    expect(lineas[0].descripcion).toBe('  Gas ')
    expect(nombreBoleta([l('  Gas ', '2026-10-02', 'b')])).toBe('Gas')
  })

  it('sin líneas (o sin descripciones): "Boleta sin líneas"', () => {
    expect(nombreBoleta([])).toBe('Boleta sin líneas')
    expect(nombreBoleta(null)).toBe('Boleta sin líneas')
    expect(nombreBoleta(undefined)).toBe('Boleta sin líneas')
    expect(nombreBoleta([l('  ', '2026-10-01', 'a')])).toBe('Boleta sin líneas')
  })
})
