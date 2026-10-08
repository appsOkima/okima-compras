import { useCallback, useEffect, useMemo, useState } from 'react'
import { emailDeLogin } from '../lib/credenciales'
import { esRolValido } from '../lib/permisos'
import { supabase } from '../lib/supabase'
import { AuthContext } from './contexto'

// Sesión de Supabase Auth + perfil (rol y nombre) de la tabla `perfiles`.
// `cargando` es true hasta saber si hay sesión y, si la hay, hasta traer el perfil.
export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [sesionLista, setSesionLista] = useState(false)
  // Perfil de un usuario concreto: mientras no coincida con la sesión actual, está cargando.
  const [cargado, setCargado] = useState({ id: null, perfil: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setSesionLista(true)
    })
    // El callback no hace consultas a Supabase (podría bloquear el cliente): solo guarda la sesión.
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva))
    return () => data.subscription.unsubscribe()
  }, [])

  const idUsuario = sesion?.user?.id ?? null
  useEffect(() => {
    if (!idUsuario) return undefined
    let vigente = true
    supabase
      .from('perfiles')
      .select('id, rol, nombre_mostrar')
      .eq('id', idUsuario)
      .maybeSingle()
      .then(({ data }) => {
        if (vigente) setCargado({ id: idUsuario, perfil: data && esRolValido(data.rol) ? data : null })
      })
    return () => {
      vigente = false
    }
  }, [idUsuario])

  const perfil = idUsuario && cargado.id === idUsuario ? cargado.perfil : null
  const perfilListo = !idUsuario || cargado.id === idUsuario

  // Mensaje genérico: no revela si el usuario existe.
  const iniciarSesion = useCallback(async (usuario, clave) => {
    const email = emailDeLogin(usuario)
    if (!email || !clave) return 'Ingresa tu usuario y tu clave.'
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
    if (!error) return null
    return error.status === 400 || error.status === 401 || error.code === 'invalid_credentials'
      ? 'Usuario o clave incorrectos.'
      : 'No se pudo iniciar sesión. Intenta de nuevo.'
  }, [])

  const cerrarSesion = useCallback(() => supabase.auth.signOut(), [])

  // Cambio de clave obligatorio del primer ingreso; devuelve el mensaje de error o null.
  const cambiarClave = useCallback(async (clave) => {
    const { data, error } = await supabase.auth.updateUser({ password: clave, data: { debe_cambiar_clave: false } })
    if (error) return 'No se pudo cambiar la clave. Intenta de nuevo.'
    setSesion((actual) => (actual ? { ...actual, user: data.user } : actual))
    return null
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      perfil,
      cargando: !sesionLista || !perfilListo,
      debeCambiarClave: sesion?.user?.user_metadata?.debe_cambiar_clave === true,
      iniciarSesion,
      cerrarSesion,
      cambiarClave,
    }),
    [sesion, perfil, sesionLista, perfilListo, iniciarSesion, cerrarSesion, cambiarClave],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
