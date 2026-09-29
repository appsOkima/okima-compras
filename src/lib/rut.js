// RUT chileno: formato al escribir (puntos y guion) y validación del dígito
// verificador con módulo 11 (sin React, para poder verificarlo con node).
// Para comparar RUTs escritos distinto (duplicados) se sigue usando normalizarRut.
import { editarConFormato, posicionTras } from './cursor.js'
import { normalizarRut } from './texto.js'

export const MENSAJE_RUT_INVALIDO = 'RUT inválido: revisa el dígito verificador.'

// Cuerpo de hasta 8 dígitos + el dígito verificador.
const MAXIMO_SIGNIFICATIVOS = 9

// Solo dígitos y K (en mayúscula), sin ceros iniciales. La K solo puede ser el
// último carácter (el DV): una K que queda en el cuerpo (ej. al escribir un dígito
// después de ella) se descarta. Lo que pase de 9 caracteres se ignora.
// "76.086.428-k" → "76086428K"; "0012k3" → "123".
export function limpiarRut(texto) {
  if (texto === null || texto === undefined) return ''
  const significativos = String(texto)
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
  const final = significativos.endsWith('K') ? 'K' : ''
  return (significativos.replace(/K/g, '') + final).replace(/^0+/, '').slice(0, MAXIMO_SIGNIFICATIVOS)
}

// Formato de presentación: puntos cada 3 dígitos del cuerpo y guion antes del DV
// (como al escribirlo). Un solo carácter queda tal cual: todavía no hay DV.
// "123456789" → "12.345.678-9"; "1234" → "123-4"; "1" → "1".
export function formatearRut(texto) {
  const limpio = limpiarRut(texto)
  if (limpio.length <= 1) return limpio
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${limpio.slice(-1)}`
}

// Dígito verificador por módulo 11: pesos 2..7 desde la derecha, 11 → '0' y 10 → 'K'.
export function calcularDv(cuerpo) {
  let suma = 0
  let peso = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * peso
    peso = peso === 7 ? 2 : peso + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

// true si el texto es un RUT (con o sin puntos/guion, k minúscula aceptada) cuyo
// DV calza. Estricto: no descarta caracteres extraños como limpiarRut.
export function validarRut(texto) {
  const partes = normalizarRut(texto).replace(/^0+/, '').match(/^(\d{1,8})([\dK])$/)
  return partes !== null && calcularDv(partes[1]) === partes[2]
}

// --- Cursor estable al formatear (InputRut) ---

// Cuántos caracteres de limpiarRut(texto) quedan antes de `posicion` en el texto
// crudo (con las mismas reglas: K fuera del final y ceros iniciales no cuentan).
export function significativosAntes(texto, posicion) {
  const todos = String(texto ?? '')
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
  let previos = String(texto ?? '')
    .slice(0, posicion)
    .toUpperCase()
    .replace(/[^0-9K]/g, '')
  // La K final solo cuenta si el cursor ya la pasó.
  const incluyeKFinal = todos.endsWith('K') && previos.length === todos.length
  previos = previos.replace(/K/g, '') + (incluyeKFinal ? 'K' : '')
  return Math.min(previos.replace(/^0+/, '').length, limpiarRut(texto).length)
}

const esSignificativoRut = (caracter) => /[0-9K]/.test(caracter)

// Posición en el texto formateado justo después de `cantidad` caracteres
// significativos (0 → al inicio).
export function posicionTrasSignificativos(formateado, cantidad) {
  return posicionTras(formateado, cantidad, esSignificativoRut)
}

const FORMATO_RUT = {
  limpiar: limpiarRut,
  formatear: formatearRut,
  significativosAntes,
  esSignificativo: esSignificativoRut,
}

// Aplica un cambio del input (ver editarConFormato en cursor.js): devuelve el
// nuevo valor formateado y dónde dejar el cursor. Si se borró solo un punto o el
// guion, se borra el dígito de al lado (el anterior con Retroceso, el siguiente
// con Suprimir, `haciaAdelante`).
export function editarRut(anterior, crudo, cursor, haciaAdelante = false) {
  return editarConFormato(anterior, crudo, cursor, haciaAdelante, FORMATO_RUT)
}
