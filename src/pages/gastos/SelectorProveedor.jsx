import { X } from 'lucide-react'
import Combobox from '../../components/Combobox'

// Proveedor opcional de un gasto: búsqueda sobre los existentes, sin creación al
// vuelo (un proveedor nuevo pide RUT; se crea en Proveedores). El botón X deja
// el gasto sin proveedor.
function SelectorProveedor({ id, valor, onChange, opciones, cargando, error }) {
  const placeholder = cargando
    ? 'Cargando proveedores…'
    : error
      ? 'No se pudieron cargar los proveedores'
      : 'Buscar proveedor (opcional)…'

  return (
    <div className="flex items-center gap-2">
      <Combobox
        id={id}
        className="flex-1"
        opciones={opciones}
        valor={valor}
        onChange={onChange}
        placeholder={placeholder}
        disabled={cargando}
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Quitar proveedor"
          title="Quitar proveedor"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default SelectorProveedor
