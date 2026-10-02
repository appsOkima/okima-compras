import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Combobox from '../../components/Combobox'
import InputNumero from '../../components/InputNumero'
import { claseBotonSecundario, claseInput } from '../../components/estilos'
import { numeroAEditable } from '../../lib/numero'
import { factorPorDefecto } from '../../lib/vinculos'

// Lista editable de vínculos de un insumo del proveedor: filas { insumo Okima,
// factor }. `valor` son las filas editables (ver vinculosEditables) y `onChange`
// recibe la lista nueva; quien guarda arma los cambios con cambiosVinculos.
// `opciones` = opciones del Combobox de insumos Okima; `cantidadFormato` (número o
// null) da el factor por defecto de una fila nueva. Un insumo Okima ya elegido en
// otra fila no se ofrece de nuevo (la base no admite el mismo par dos veces).
function EditorVinculos({ id, valor, onChange, opciones, cantidadFormato, cargando = false }) {
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
          <Combobox
            className="min-w-56 flex-1"
            opciones={opciones.filter((o) => o.valor === fila.id_insumo_okima || !usados.has(o.valor))}
            valor={fila.id_insumo_okima}
            onChange={(v) => cambiarFila(fila.clave, 'id_insumo_okima', v)}
            placeholder={cargando ? 'Cargando insumos…' : 'Buscar insumo Okima…'}
            etiqueta={`Insumo Okima del vínculo ${i + 1}`}
            disabled={cargando}
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
          <button
            type="button"
            onClick={() => quitarFila(fila.clave)}
            className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label={`Quitar vínculo ${i + 1}`}
            title="Quitar vínculo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
