import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

// Mismo texto que el Cancelar del formulario de Facturas.
const TEXTO_CONFIRMAR_SALIDA = 'Hay cambios sin guardar. ¿Salir sin guardarlos?'

// Mientras `sucio` (el formulario tiene cambios sin guardar) pide confirmar antes
// de salir de la página: toda navegación interna (menú, pestañas, Volver,
// Cancelar, atrás/adelante del navegador) con window.confirm vía useBlocker (por
// eso App usa un enrutador de datos), y recargar o cerrar la pestaña con el
// aviso propio del navegador (beforeunload, su texto no se puede cambiar).
// Una navegación que se queda en la misma ruta y búsqueda (ej. limpiar el state)
// no se bloquea.
// Devuelve `permitirSalida()`: se llama justo antes del navigate que sigue a un
// guardado exitoso. Es una ref y no estado porque el navigate ocurre en el mismo
// evento, antes de que React vuelva a renderizar con `sucio = false`.
export function useConfirmarSalida(sucio) {
  const salidaPermitida = useRef(false)

  const debeBloquear = useCallback(
    ({ currentLocation, nextLocation }) =>
      sucio &&
      !salidaPermitida.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
    [sucio],
  )
  const blocker = useBlocker(debeBloquear)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(TEXTO_CONFIRMAR_SALIDA)) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!sucio) return
    const avisar = (e) => {
      if (salidaPermitida.current) return
      e.preventDefault()
      // Navegadores antiguos requieren returnValue para mostrar el aviso.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  return useCallback(() => {
    salidaPermitida.current = true
  }, [])
}
