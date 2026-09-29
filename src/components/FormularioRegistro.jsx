import { useId, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { mensajeError } from '../lib/errores'
import { formatearRut, MENSAJE_RUT_INVALIDO, validarRut } from '../lib/rut'
import InputRut from './InputRut'
import OpcionesSelect from './OpcionesSelect'
import { claseBotonAdvertencia, claseBotonPrimario, claseBotonSecundario, claseInput } from './estilos'

// Valor de la base → valor editable del input. Los <input> no aceptan null.
function aEditable(campo, valor) {
  if (campo.tipo === 'booleano') {
    if (campo.anulable) return valor === true ? 'true' : valor === false ? 'false' : ''
    return Boolean(valor)
  }
  if (campo.tipo === 'personalizado') return valor ?? ''
  // Un RUT guardado sin formato (ej. datos viejos) se muestra formateado.
  if (campo.tipo === 'rut') return formatearRut(valor)
  return valor === null || valor === undefined ? '' : String(valor)
}

// Valor editable → valor para la base: '' queda null y los números como Number.
function aGuardable(campo, valor) {
  switch (campo.tipo) {
    case 'booleano':
      if (!campo.anulable) return Boolean(valor)
      return valor === 'true' ? true : valor === 'false' ? false : null
    case 'numero': {
      const texto = String(valor ?? '').trim().replace(',', '.')
      return texto === '' ? null : Number(texto)
    }
    case 'rut':
      return formatearRut(valor) || null
    case 'texto':
    case 'area': {
      const texto = String(valor ?? '').trim()
      return texto === '' ? null : texto
    }
    default:
      return valor === '' || valor === undefined ? null : valor
  }
}

function esVisible(campo, valores) {
  return campo.visible ? campo.visible(valores) : true
}

// Ubicación de un campo en la grilla de 2 columnas (ver `enColumnas`).
function claseColumna(campo) {
  if (campo.tipo === 'area' || campo.completo) return 'sm:col-span-2'
  return campo.nuevaFila ? 'sm:col-start-1' : undefined
}

// Formulario de creación/edición guiado por la lista de `campos`.
// Solo envía las claves declaradas en `campos` (no las relaciones embebidas).
// Opcionales por campo: `validar(valor, salida)` devuelve un mensaje de error o
// nada (ej. cantidad > 0) y `sugerencias` (lista de textos) agrega autocompletado
// a un campo de texto sin restringir lo que se escribe.
// `textoDuplicados(duplicados)` (opcional) reemplaza el encabezado del aviso de
// duplicados (ej. "Ya registraste Arriendo en septiembre 2026").
// `enColumnas` (opcional, ej. en página propia) reparte los campos en 2 columnas
// desde sm; las áreas de texto y los campos con `completo: true` ocupan todo el
// ancho, igual que avisos y botones, y un campo con `nuevaFila: true` parte en la
// columna izquierda aunque la fila anterior haya quedado a medias (ej. para que
// Venta directa y su precio queden juntos).
// `onCambio()` (opcional, ej. en página propia) se llama en cada cambio que hace
// el usuario, para saber que hay algo sin guardar (ver useConfirmarSalida).
// Campo `tipo: 'rut'`: se formatea al escribir (InputRut) y se guarda formateado.
// Su dígito verificador se valida al salir del campo (muestra o quita el error;
// vacío no se revisa aquí, eso es de `requerido`) y otra vez al guardar, donde un
// RUT inválido bloquea igual que un campo obligatorio vacío.
function FormularioRegistro({
  campos,
  valoresIniciales = {},
  onGuardar,
  onCancelar,
  buscarDuplicados,
  etiquetaDuplicado = (r) => r.nombre,
  textoDuplicados,
  textoGuardar = 'Guardar',
  enColumnas = false,
  onCambio,
}) {
  const idBase = useId()
  const [valores, setValores] = useState(() =>
    Object.fromEntries(campos.map((c) => [c.clave, aEditable(c, valoresIniciales[c.clave])])),
  )
  const [errores, setErrores] = useState({})
  const [errorGuardar, setErrorGuardar] = useState('')
  const [duplicados, setDuplicados] = useState([])
  const [guardando, setGuardando] = useState(false)

  const cambiar = (clave, valor) => {
    setValores((actuales) => ({ ...actuales, [clave]: valor }))
    setErrores((actuales) => ({ ...actuales, [clave]: undefined }))
    // Cualquier cambio invalida el aviso de duplicados: se vuelve a chequear al guardar.
    setDuplicados([])
    onCambio?.()
  }

  // Validación al salir del campo: por ahora solo el dígito verificador del RUT.
  const salir = (campo) => {
    if (campo.tipo !== 'rut' || !valores[campo.clave]) return
    const mensaje = validarRut(valores[campo.clave]) ? undefined : MENSAJE_RUT_INVALIDO
    setErrores((actuales) => ({ ...actuales, [campo.clave]: mensaje }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (guardando) return

    const salida = {}
    const nuevosErrores = {}
    for (const campo of campos) {
      // Un campo oculto no aplica (ej. precio_venta sin venta directa): se guarda vacío.
      if (!esVisible(campo, valores)) {
        salida[campo.clave] = campo.tipo === 'booleano' && !campo.anulable ? false : null
        continue
      }
      const valor = aGuardable(campo, valores[campo.clave])
      if (campo.tipo === 'numero' && valor !== null && !Number.isFinite(valor)) {
        nuevosErrores[campo.clave] = 'Debe ser un número.'
      } else if (campo.requerido && valor === null) {
        nuevosErrores[campo.clave] = 'Este campo es obligatorio.'
      } else if (campo.tipo === 'rut' && valor !== null && !validarRut(valor)) {
        nuevosErrores[campo.clave] = MENSAJE_RUT_INVALIDO
      }
      salida[campo.clave] = valor
    }
    // Validaciones propias, con la salida completa ya convertida.
    for (const campo of campos) {
      if (nuevosErrores[campo.clave] || !campo.validar || !esVisible(campo, valores)) continue
      const mensaje = campo.validar(salida[campo.clave], salida)
      if (mensaje) nuevosErrores[campo.clave] = mensaje
    }
    setErrores(nuevosErrores)
    setErrorGuardar('')
    if (Object.keys(nuevosErrores).length > 0) return

    // Primer clic: si hay registros parecidos se avisa; el segundo clic guarda igual.
    if (buscarDuplicados && duplicados.length === 0) {
      const encontrados = buscarDuplicados(salida) ?? []
      if (encontrados.length > 0) {
        setDuplicados(encontrados)
        return
      }
    }

    setGuardando(true)
    try {
      await onGuardar(salida)
    } catch (error) {
      setErrorGuardar(mensajeError(error))
      setGuardando(false)
    }
  }

  // En 2 columnas, lo que no es un campo de a pares ocupa toda la fila.
  const anchoTotal = enColumnas ? ' sm:col-span-2' : ''

  return (
    <form onSubmit={enviar} noValidate className={enColumnas ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
      {campos
        .filter((campo) => esVisible(campo, valores))
        .map((campo) => (
          <Campo
            key={campo.clave}
            id={`${idBase}-${campo.clave}`}
            className={enColumnas ? claseColumna(campo) : undefined}
            campo={campo}
            valor={valores[campo.clave]}
            valores={valores}
            error={errores[campo.clave]}
            onChange={(valor) => cambiar(campo.clave, valor)}
            onBlur={() => salir(campo)}
          />
        ))}

      {duplicados.length > 0 && (
        <div className={`rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800${anchoTotal}`} role="alert">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {textoDuplicados
              ? textoDuplicados(duplicados)
              : `Ya existe${duplicados.length === 1 ? ' un registro parecido' : 'n registros parecidos'}:`}
          </p>
          <ul className="mt-1 list-disc pl-9">
            {duplicados.slice(0, 5).map((r) => (
              <li key={r.id}>{etiquetaDuplicado(r)}</li>
            ))}
            {duplicados.length > 5 && <li>y {duplicados.length - 5} más…</li>}
          </ul>
          <p className="mt-2">Revisa que no sea el mismo antes de guardar.</p>
        </div>
      )}

      {errorGuardar && (
        <p
          className={`flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700${anchoTotal}`}
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorGuardar}
        </p>
      )}

      <div className={`flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end${anchoTotal}`}>
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className={duplicados.length > 0 ? claseBotonAdvertencia : claseBotonPrimario}
        >
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          {duplicados.length > 0 ? 'Guardar de todos modos' : textoGuardar}
        </button>
      </div>
    </form>
  )
}

function Campo({ id, className, campo, valor, valores, error, onChange, onBlur }) {
  const { etiqueta, tipo, requerido, ayuda } = campo
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const claseError = error ? ' border-red-400 focus:border-red-500 focus:ring-red-500/30' : ''

  // Booleano no anulable: casilla con la etiqueta al lado.
  if (tipo === 'booleano' && !campo.anulable) {
    return (
      <div className={className}>
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            id={id}
            type="checkbox"
            checked={valor}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={idAyuda}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          {etiqueta}
        </label>
        {ayuda && (
          <p id={idAyuda} className="mt-1 pl-6 text-xs text-slate-500">
            {ayuda}
          </p>
        )}
      </div>
    )
  }

  const comunes = {
    id,
    'aria-describedby': idAyuda,
    'aria-invalid': error ? true : undefined,
    className: claseInput + claseError,
  }

  let control
  if (tipo === 'personalizado') {
    control = campo.render({ id, valor, onChange, valores, requerido })
  } else if (tipo === 'area') {
    control = <textarea {...comunes} rows={3} value={valor} onChange={(e) => onChange(e.target.value)} />
  } else if (tipo === 'seleccion') {
    control = (
      <select {...comunes} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{requerido ? 'Selecciona…' : 'Sin definir'}</option>
        <OpcionesSelect opciones={campo.opciones ?? []} />
      </select>
    )
  } else if (tipo === 'booleano') {
    control = (
      <select {...comunes} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin definir</option>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    )
  } else if (tipo === 'rut') {
    control = <InputRut {...comunes} valor={valor} onChange={onChange} onBlur={onBlur} />
  } else if (tipo === 'numero') {
    control = (
      <input
        {...comunes}
        type="number"
        inputMode="decimal"
        step={campo.paso ?? 'any'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  } else {
    // Con sugerencias, el navegador ofrece solo esas (no su historial de formularios).
    const idSugerencias = campo.sugerencias?.length ? `${id}-sugerencias` : undefined
    control = (
      <>
        <input
          {...comunes}
          type={tipo === 'fecha' ? 'date' : 'text'}
          value={valor}
          list={idSugerencias}
          autoComplete={idSugerencias ? 'off' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {idSugerencias && (
          <datalist id={idSugerencias}>
            {campo.sugerencias.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </>
    )
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
        {requerido && <span className="text-red-600"> *</span>}
      </label>
      {control}
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-xs text-slate-500">
          {ayuda}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default FormularioRegistro
