import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/contexto'
import ComboboxInsumoOkima from '../../components/ComboboxInsumoOkima'
import InputNumero from '../../components/InputNumero'
import { claseBotonSecundario, claseInput } from '../../components/estilos'
import { numeroAEditable } from '../../lib/numero'
import { puedeHacer } from '../../lib/permisos'
import { factorPorDefecto } from '../../lib/vinculos'

// Lista editable de vínculos de un insumo del proveedor: filas { insumo Okima,
// factor }. `valor` son las filas editables (ver vinculosEditables) y `onChange`
// recibe la lista nueva; quien guarda arma los cambios con cambiosVinculos.
// `insumos` = insumos Okima (con subcategoría); `onCrearInsumo` crea uno al vuelo
// (solo nombre + subcategoría); `sugerido` = texto que se ofrece para crear; `cantidadFormato` (número o
// null) da el factor por defecto de una fila nueva. Un insumo Okima ya elegido en
// otra fila no se ofrece de nuevo (la base no admite el mismo par dos veces).
// Quitar un vínculo ya guardado lo borra de la base: solo contador y admin (el productor
// puede quitar las filas que acaba de agregar, aún sin guardar).
function EditorVinculos({ id, valor, onChange, insumos, onCrearInsumo, sugerido = '', cantidadFormato, cargando = false }) {
  const { perfil } = useAuth()
  const puedeBorrar = puedeHacer(perfil?.rol, 'vinculos', 'borrar')
  const filas = Array.isArray(valor) ? valor : []
  const siguiente = useRef(0)

  const cambiarFila = (clave, campo, nuevo) =>
    onChange(filas.map((f) => (f.clave === clave ? { ...f, [campo]: nuevo } : f)))
  const quitarFila = (clave) => onChange(filas.filter((f) => f.clave !== clave))
  const agregarFila = () =>
    onChange([
      ...filas,
      { clave: `nueva-${++siguiente.current}`, id_insumo_okima: '', factor: numeroAEditable(factorPorDefecto(cantidadFormato)) },
    ])

  const usados = new Set(filas.map((f) => f.id_insumo_okima).filter(Boolean))

  return (
    <div id={id} className="space-y-2">
      {filas.length === 0 && <p className="text-sm text-slate-500">Sin vincular: sus compras no suman stock.</p>}
      {filas.map((fila, i) => (
        <div key={fila.clave} className="flex flex-wrap items-center gap-2">
          <ComboboxInsumoOkima
            className="min-w-56 flex-1"
            insumos={insumos}
            excluir={usados}
            valor={fila.id_insumo_okima}
            onChange={(v) => cambiarFila(fila.clave, 'id_insumo_okima', v)}
            onCrearInsumo={onCrearInsumo}
            sugerido={sugerido}
            placeholder="Buscar o crear insumo Okima…"
            etiqueta={`Insumo Okima del vínculo ${i + 1}`}
            cargando={cargando}
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            ×
            <InputNumero
              className={`${claseInput} w-28`}
              valor={fila.factor}
              onChange={(v) => cambiarFila(fila.clave, 'factor', v)}
              placeholder="Factor"
              aria-label={`Factor de conversión del vínculo ${i + 1}`}
            />
          </label>
          {(puedeBorrar || !fila.id) && (
            <button
              type="button"
              onClick={() => quitarFila(fila.clave)}
              className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
              aria-label={`Quitar vínculo ${i + 1}`}
              title="Quitar vínculo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={agregarFila} className={claseBotonSecundario}>
        <Plus className="h-4 w-4" />
        Agregar insumo Okima
      </button>
    </div>
  )
}

export default EditorVinculos
