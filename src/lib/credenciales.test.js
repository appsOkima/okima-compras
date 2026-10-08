import { describe, expect, it } from 'vitest'
import { emailDeLogin, errorNuevaClave } from './credenciales'

describe('emailDeLogin', () => {
  it('completa el dominio cuando solo viene el nombre', () => {
    expect(emailDeLogin('tac')).toBe('tac@okima.cl')
    expect(emailDeLogin('  Tac ')).toBe('tac@okima.cl')
  })
  it('respeta un email completo', () => {
    expect(emailDeLogin('Jorge@Okima.cl')).toBe('jorge@okima.cl')
  })
  it('vacío queda vacío', () => {
    expect(emailDeLogin('   ')).toBe('')
  })
})

describe('errorNuevaClave', () => {
  it('exige mínimo 8 caracteres', () => {
    expect(errorNuevaClave('abc1234', 'abc1234')).toMatch(/8 caracteres/)
  })
  it('exige que ambas coincidan', () => {
    expect(errorNuevaClave('abcd1234', 'abcd12345')).toMatch(/coinciden/)
  })
  it('válida: null', () => {
    expect(errorNuevaClave('abcd1234', 'abcd1234')).toBeNull()
  })
})
