// Exportación CSV pensada para Excel con configuración regional es-CL:
// separador ';' (la coma es el separador decimal) y BOM UTF-8 para las tildes.

const SEPARADOR = ';'
const FIN_LINEA = '\r\n'

function celda(valor) {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  // Excel es-CL usa coma decimal: "1.5" lo leería como 15.
  if (typeof valor === 'number') return String(valor).replace('.', ',')
  const texto = String(valor)
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

// columnas = [{ titulo, valor: (fila) => any }]. Pura: no toca el DOM.
export function generarCsv(filas, columnas) {
  const encabezado = columnas.map((c) => celda(c.titulo)).join(SEPARADOR)
  const cuerpo = (filas ?? []).map((fila) => columnas.map((c) => celda(c.valor(fila))).join(SEPARADOR))
  return [encabezado, ...cuerpo].join(FIN_LINEA)
}

export function descargarCsv(nombreArchivo, contenido) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
