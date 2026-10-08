// Textos de búsqueda de los listados que se recuerdan mientras el usuario sigue en la
// misma sección (ver hooks/useBusquedaPersistente). Lógica pura, sin React.

// Primer segmento del pathname: '/facturas/lineas' -> '/facturas'; el inicio es '/'.
export function seccionDe(pathname) {
  const primero = pathname.split('/').filter(Boolean)[0]
  return primero ? `/${primero}` : '/'
}

// Almacén en memoria: un texto por vista (clave = pathname del listado). Al navegar a otra
// sección se vacía completo; dentro de la misma sección (listado, detalle, edición, líneas)
// se conserva.
export function crearAlmacenBusquedas() {
  let textos = new Map()
  let seccion = null

  return {
    leer: (clave) => textos.get(clave) ?? '',
    escribir: (clave, texto) => {
      textos.set(clave, texto)
    },
    alNavegar: (pathname) => {
      const nueva = seccionDe(pathname)
      if (seccion !== null && nueva !== seccion) textos = new Map()
      seccion = nueva
    },
  }
}
