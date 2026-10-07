import { describe, expect, it } from 'vitest'
import { errorSinFilas, MENSAJE_SIN_FILAS, mensajeError } from './errores'

describe('mensajeError', () => {
  it('42501 con mensaje de la base en español: se muestra tal cual', () => {
    const error = { code: '42501', message: 'Solo un administrador puede reactivar un documento anulado.' }
    expect(mensajeError(error)).toBe('Solo un administrador puede reactivar un documento anulado.')
  })

  it('42501 de RLS (mensaje en inglés): mensaje genérico de permisos', () => {
    const error = { code: '42501', message: 'new row violates row-level security policy for table "facturas"' }
    expect(mensajeError(error)).toBe('Tu rol no tiene permiso para realizar esta acción.')
  })

  it('42501 sin mensaje: mensaje genérico de permisos', () => {
    expect(mensajeError({ code: '42501' })).toBe('Tu rol no tiene permiso para realizar esta acción.')
  })

  it('23514 de la exclusividad factura/boleta: se muestra el mensaje de la base', () => {
    const error = { code: '23514', message: 'La solicitud ya está vinculada a líneas de factura y no puede vincularse también a una boleta.' }
    expect(mensajeError(error)).toBe(error.message)
  })

  it('23514 sin mensaje: texto genérico', () => {
    expect(mensajeError({ code: '23514' })).toBe('El dato no cumple una regla del sistema.')
  })

  it('mantiene los mensajes existentes', () => {
    expect(mensajeError({ code: '23505' })).toBe('Ya existe un registro con esos datos.')
    expect(mensajeError(null)).toBe('')
  })

  it('PGRST116 (update con .single() sin filas, ej. RLS): mensaje de permiso o registro ausente', () => {
    const error = { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' }
    expect(mensajeError(error)).toBe(MENSAJE_SIN_FILAS)
  })
})

describe('errorSinFilas', () => {
  it('con las filas esperadas: null', () => {
    expect(errorSinFilas([{ id: 1 }])).toBeNull()
    expect(errorSinFilas([{ id: 1 }, { id: 2 }], 2)).toBeNull()
  })

  it('vacío, ausente o menos filas de las esperadas: error con el mensaje de permiso', () => {
    for (const [data, esperadas] of [[[], 1], [null, 1], [undefined, 1], [[{ id: 1 }], 2]]) {
      expect(errorSinFilas(data, esperadas).message).toBe(MENSAJE_SIN_FILAS)
    }
  })
})
