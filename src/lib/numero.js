// Números con formato chileno al escribir: punto de miles (1.234.567) y coma
// decimal (1.234,5). Sin React, para poder verificarlo con node.
// El punto es siempre separador de miles: al escribir se ignora y al pegar
// "1234.5" se lee 12.345. Los decimales van solo con coma. Sin negativos.
// Hay dos orígenes de texto que no se deben mezclar:
// - lo que escribe el usuario (formato chileno) → aNumeroDesdeTexto;
// - lo que viene de la base (número o texto con punto decimal, ej. '1234.5' de
//   un numeric de Postgres) → numeroDesdeBase / numeroAEditable.
import { editarConFormato, posicionTras } from './cursor.js'

// Opciones de todas las funciones: { decimales = true }. Con `decimales: false`
// (campos enteros, ej. montos CLP) la coma no se acepta.

// Recorre el texto crudo y decide qué caracteres quedan: dígitos y (con
// decimales) la primera coma. De la parte entera se van los ceros iniciales, pero
// queda un solo '0' si es todo ceros ('00' → '0'), para poder escribir 0. Si hay
// coma sin parte entera se antepone un '0' (',5' → '0,5'), ubicado en la coma.
// → [{ caracter, indice }] con el índice en el texto crudo (para el cursor).
function analizar(texto, { decimales = true } = {}) {
  const crudo = String(texto ?? '')
  const enteros = []
  const fraccion = []
  let coma = -1
  for (let i = 0; i < crudo.length; i++) {
    const c = crudo[i]
    if (c >= '0' && c <= '9') (coma === -1 ? enteros : fraccion).push(i)
    else if (c === ',' && decimales && coma === -1) coma = i
  }
  let inicio = 0
  while (inicio < enteros.length - 1 && crudo[enteros[inicio]] === '0') inicio++
  const quedan = enteros.slice(inicio).map((i) => ({ caracter: crudo[i], indice: i }))
  if (coma !== -1) {
    if (quedan.length === 0) quedan.push({ caracter: '0', indice: coma })
    quedan.push({ caracter: ',', indice: coma })
    for (const i of fraccion) quedan.push({ caracter: crudo[i], indice: i })
  }
  return quedan
}

// Solo dígitos y (con decimales) la primera coma; puntos, letras, signos y
// espacios se descartan. Una coma al final se conserva mientras se escribe
// ('12,'). En campos enteros la coma se quita y los dígitos siguen (no se corta
// lo que venía después): '12,5' → '125'.
// '1.234,5' → '1234,5'; '007' → '7'; ',5' → '0,5'; '1,2,3' → '1,23'.
export function limpiarNumero(texto, opciones) {
  return analizar(texto, opciones)
    .map((q) => q.caracter)
    .join('')
}

// Puntos de miles en la parte entera; la parte decimal queda tal cual.
// '1234567,891' → '1.234.567,891'; '1234.5' → '12.345'.
export function formatearNumero(texto, opciones) {
  const [entero, ...resto] = limpiarNumero(texto, opciones).split(',')
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return resto.length > 0 ? `${conMiles},${resto.join('')}` : conMiles
}

// Número con punto decimal escrito "a lo JS" (sin exponentes ni hex).
const NUMERO_JS = /^-?(\d+\.?\d*|\.\d+)$/

// Texto en formato chileno (o un Number) → Number, o null si está vacío o no es
// un número. Quita los puntos de miles y cambia la coma por punto.
// '1.234,5' → 1234.5; '12,' → 12; '' → null; 'abc' → null.
export function aNumeroDesdeTexto(valor) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = String(valor).trim().replace(/\./g, '').replace(',', '.')
  return NUMERO_JS.test(texto) ? Number(texto) : null
}

// Valor de la base (Number o texto con punto decimal, ej. '1234.50') → Number,
// o null. A diferencia de aNumeroDesdeTexto, aquí el punto es decimal.
export function numeroDesdeBase(valor) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const texto = String(valor).trim()
  return NUMERO_JS.test(texto) ? Number(texto) : null
}

// Number → texto con punto decimal y sin exponente (1e21 → '1000000000000000000000').
function textoPlano(n) {
  const texto = String(n)
  if (!/e/i.test(texto)) return texto
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { useGrouping: false })
  return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
}

// Valor de la base → texto editable formateado; null, '' o inválido → ''.
// 1234.5 y '1234.50' → '1.234,5'; 1e6 → '1.000.000'. En campos enteros se
// redondea al entero (un monto CLP con decimales en la base, ej. de datos viejos,
// no se debe leer juntando los dígitos: 1234,5 no puede pasar a 12.345).
export function numeroAEditable(valor, { decimales = true } = {}) {
  const n = numeroDesdeBase(valor)
  if (n === null) return ''
  const plano = textoPlano(decimales ? n : Math.round(n))
  return formatearNumero(plano.replace('.', ','), { decimales })
}

// --- Cursor estable al formatear (InputNumero) ---

const esSignificativoNumero = (caracter) => /[0-9,]/.test(caracter)

// Cuántos caracteres de limpiarNumero(texto) quedan antes de `posicion` en el
// texto crudo (el '0' que se antepone a la coma cuenta junto con ella).
export function significativosAntesNumero(texto, posicion, opciones) {
  return analizar(texto, opciones).filter((q) => q.indice < posicion).length
}

// Posición en el texto formateado justo después de `cantidad` dígitos o coma.
export function posicionTrasNumero(formateado, cantidad) {
  return posicionTras(formateado, cantidad, esSignificativoNumero)
}

// Aplica un cambio del input (ver editarConFormato en cursor.js): devuelve el
// nuevo valor formateado y dónde dejar el cursor. Borrar solo un punto de miles
// borra el dígito de al lado (el anterior con Retroceso, el siguiente con
// Suprimir, `haciaAdelante`).
export function editarNumero(anterior, crudo, cursor, haciaAdelante = false, opciones = {}) {
  return editarConFormato(anterior, crudo, cursor, haciaAdelante, {
    limpiar: (texto) => limpiarNumero(texto, opciones),
    formatear: (texto) => formatearNumero(texto, opciones),
    significativosAntes: (texto, posicion) => significativosAntesNumero(texto, posicion, opciones),
    esSignificativo: esSignificativoNumero,
  })
}
