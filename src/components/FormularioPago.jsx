import { useState } from 'react'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import { mensajeError } from '../lib/errores'
import { validarPago } from '../lib/pagos'
import InputNumero from './InputNumero'
import { claseBotonPrimario, claseBotonSecundario, claseInput } from './estilos'

// Formulario de un pago (alta y edición): monto, fecha y notas.
// - `valoresIniciales`: { monto (texto editable, ver numeroAEditable), fecha, notas }.
// - `avisoSobrepago(monto)`: texto de aviso o null; si hay aviso se pide confirmación
//   explícita (el sobrepago se permite).
// - `onGuardar({ monto, fecha_pago, notas })`: async; lanza el error de la base, que se
//   muestra con mensajeError.
function FormularioPago({ valoresIniciales, avisoSobrepago, onGuardar, onCancelar, textoBoton = 'Guardar pago' }) {
  const [monto, setMonto] = useState(valoresIniciales.monto)
  const [fecha, setFecha] = useState(valoresIniciales.fecha)
  const [notas, setNotas] = useState(valoresIniciales.notas ?? '')
  const [errores, setErrores] = useState({})
  const [errorGuardar, setErrorGuardar] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    const { valido, errores: erroresValidacion, datos } = validarPago({ monto, fecha })
    setErrores(erroresValidacion)
    if (!valido) return
    const aviso = avisoSobrepago?.(datos.monto)
    if (aviso && !window.confirm(`${aviso}\n\n¿Registrar el pago de todos modos?`)) return
    setErrorGuardar('')
    setGuardando(true)
    try {
      await onGuardar({ ...datos, notas: notas.trim() || null })
    } catch (excepcion) {
      setErrorGuardar(mensajeError(excepcion))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700">
          Monto (CLP) <span className="text-red-600">*</span>
          <InputNumero valor={monto} onChange={setMonto} className={`${claseInput} mt-1`} aria-invalid={!!errores.monto} />
          {errores.monto && <span className="mt-1 block text-xs text-red-600">{errores.monto}</span>}
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Fecha de pago <span className="text-red-600">*</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${claseInput} mt-1`}
            aria-invalid={!!errores.fecha}
          />
          {errores.fecha && <span className="mt-1 block text-xs text-red-600">{errores.fecha}</span>}
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Notas
          <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={`${claseInput} mt-1`} />
        </label>
      </div>

      {errorGuardar && (
        <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorGuardar}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={guardando} className={claseBotonPrimario}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {textoBoton}
        </button>
      </div>
    </form>
  )
}

export default FormularioPago
