import { useId, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Plus } from 'lucide-react'
import Combobox from '../../components/Combobox'
import InputRut from '../../components/InputRut'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from '../../components/estilos'
import { mensajeError } from '../../lib/errores'
import { MENSAJE_RUT_INVALIDO, validarRut } from '../../lib/rut'
import { buscarSimilares, normalizarRut } from '../../lib/texto'

// Proveedor de la factura con creación al vuelo (skill creacion-al-vuelo): primero
// el nombre (para ver si ya existía, con "Usar este" sobre los parecidos) y luego
// el RUT, obligatorio para facturar; avisa si otro proveedor ya tiene ese RUT
// escrito de otra forma. El RUT se formatea al escribir y su dígito verificador
// se valida al salir del campo y al crear (inválido no deja crear). Se crea solo
// con { nombre, rut }: el resto queda vacío y aparece en "Incompletos" de Proveedores.
// No es un <form>: va dentro del formulario de la factura.
function SelectorProveedorFactura({ id, valor, onChange, proveedores, onCrearProveedor, cargando = false, error }) {
  const idBase = useId()
  // null = sin mini-formulario abierto.
  const [nuevo, setNuevo] = useState(null)
  const [errorCrear, setErrorCrear] = useState('')
  const [errorRut, setErrorRut] = useState('')
  const [guardando, setGuardando] = useState(false)

  const opciones = useMemo(
    () => proveedores.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.rut ? `RUT ${p.rut}` : undefined })),
    [proveedores],
  )
  const similares = useMemo(() => (nuevo ? buscarSimilares(nuevo.nombre, proveedores) : []), [nuevo, proveedores])
  const mismoRut = useMemo(() => {
    const rut = normalizarRut(nuevo?.rut)
    return rut ? proveedores.filter((p) => normalizarRut(p.rut) === rut) : []
  }, [nuevo, proveedores])
  const conAvisos = similares.length > 0 || mismoRut.length > 0

  const abrir = (texto) => {
    setNuevo({ nombre: texto, rut: '' })
    setErrorCrear('')
    setErrorRut('')
  }

  const cerrar = () => {
    setNuevo(null)
    setErrorCrear('')
    setErrorRut('')
  }

  const cambiarRut = (rut) => {
    setNuevo((actual) => ({ ...actual, rut }))
    setErrorRut('')
  }

  // Al salir del RUT: vacío no se revisa aquí (lo pide "Crear").
  const salirRut = () => setErrorRut(nuevo?.rut && !validarRut(nuevo.rut) ? MENSAJE_RUT_INVALIDO : '')

  const usarExistente = (proveedor) => {
    cerrar()
    onChange(proveedor.id)
  }

  const crear = async () => {
    if (guardando) return
    const nombre = nuevo.nombre.trim().replace(/\s+/g, ' ')
    const rut = nuevo.rut.trim()
    if (!nombre || !rut) {
      setErrorCrear('Completa el nombre y el RUT.')
      return
    }
    if (!validarRut(rut)) {
      setErrorRut(MENSAJE_RUT_INVALIDO)
      return
    }
    setGuardando(true)
    setErrorCrear('')
    try {
      const creado = await onCrearProveedor({ nombre, rut })
      setNuevo(null)
      onChange(creado.id)
    } catch (e) {
      setErrorCrear(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  // Enter en un campo crea (no envía la factura); Escape cierra el mini-formulario.
  const alPresionar = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault()
      crear()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    }
  }

  const placeholder = cargando
    ? 'Cargando proveedores…'
    : error
      ? 'No se pudieron cargar los proveedores'
      : 'Buscar o crear proveedor…'

  return (
    <div className="space-y-2">
      <Combobox
        id={id}
        opciones={opciones}
        valor={valor}
        onChange={onChange}
        onCrear={abrir}
        placeholder={placeholder}
        disabled={cargando || nuevo !== null}
      />

      {nuevo && (
        <div
          className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/60 p-3"
          role="group"
          aria-label="Nuevo proveedor"
          onKeyDown={alPresionar}
        >
          <p className="flex items-center gap-2 text-sm font-medium text-indigo-900">
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idBase}-nombre`} className="mb-1 block text-xs font-medium text-slate-700">
                Nombre <span className="text-red-600">*</span>
              </label>
              <input
                id={`${idBase}-nombre`}
                type="text"
                value={nuevo.nombre}
                onChange={(e) => setNuevo((actual) => ({ ...actual, nombre: e.target.value }))}
                className={claseInput}
              />
            </div>
            <div>
              <label htmlFor={`${idBase}-rut`} className="mb-1 block text-xs font-medium text-slate-700">
                RUT <span className="text-red-600">*</span>
              </label>
              <InputRut
                id={`${idBase}-rut`}
                valor={nuevo.rut}
                onChange={cambiarRut}
                onBlur={salirRut}
                placeholder="Ej. 76.123.456-7"
                autoFocus
                aria-invalid={errorRut ? true : undefined}
                aria-describedby={errorRut ? `${idBase}-rut-error` : undefined}
                className={
                  claseInput + (errorRut ? ' border-red-400 focus:border-red-500 focus:ring-red-500/30' : '')
                }
              />
              {errorRut && (
                <p id={`${idBase}-rut-error`} className="mt-1 flex items-start gap-1 text-xs text-red-700">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {errorRut}
                </p>
              )}
            </div>
          </div>

          <Parecidos
            titulo={`Ya existe${similares.length === 1 ? ' uno parecido' : 'n parecidos'} por nombre. ¿Es alguno de estos?`}
            proveedores={similares}
            onUsar={usarExistente}
          />
          <Parecidos
            titulo={`Ya hay ${mismoRut.length === 1 ? 'un proveedor' : 'proveedores'} con ese RUT.`}
            proveedores={mismoRut}
            onUsar={usarExistente}
          />

          {errorCrear && (
            <p className="flex items-start gap-2 text-sm text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorCrear}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={cerrar} className={claseBotonSecundario}>
              Volver
            </button>
            <button
              type="button"
              onClick={crear}
              disabled={guardando || Boolean(errorRut)}
              className={claseBotonPrimario}
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {conAvisos ? 'Crear de todos modos' : 'Crear proveedor'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Aviso ámbar con los proveedores existentes y su botón "Usar este".
function Parecidos({ titulo, proveedores, onUsar }) {
  if (proveedores.length === 0) return null
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800" role="alert">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {titulo}
      </p>
      <ul className="mt-1 space-y-1">
        {proveedores.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 pl-6">
            <span className="min-w-0 truncate">
              {p.nombre}
              {p.rut && <span className="text-amber-700/80"> (RUT {p.rut})</span>}
            </span>
            <button
              type="button"
              onClick={() => onUsar(p)}
              className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-900 underline hover:bg-amber-100"
            >
              Usar este
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SelectorProveedorFactura
