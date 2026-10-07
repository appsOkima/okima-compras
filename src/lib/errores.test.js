import { describe, expect, it } from 'vitest'
import { mensajeError } from './errores'

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

  it('mantiene los mensajes existentes', () => {
    expect(mensajeError({ code: '23505' })).toBe('Ya existe un registro con esos datos.')
    expect(mensajeError(null)).toBe('')
  })
})
