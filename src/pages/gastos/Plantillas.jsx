import EtiquetaActivo from '../../components/EtiquetaActivo'
import Mantenedor from '../../components/Mantenedor'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'
import { formatoCLP } from '../../lib/formato'

// La categoría (centro de costo) se obtiene a través de la subcategoría.
const SELECT = '*, subcategoria:subcategorias(id, nombre, categoria:categorias(id, nombre))'

const nombreSubcategoria = (fila) => fila.subcategoria?.nombre ?? ''
const nombreCategoria = (fila) => fila.subcategoria?.categoria?.nombre ?? ''

const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'categoria', titulo: 'Categoría', soloCsv: true, csv: nombreCategoria },
  { clave: 'subcategoria', titulo: 'Subcategoría', render: nombreSubcategoria, csv: nombreSubcategoria },
  {
    clave: 'monto_default',
    titulo: 'Monto por defecto',
    alinear: 'derecha',
    render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.monto_default)}</span>,
  },
  { clave: 'activo', titulo: 'Estado', render: (fila) => <EtiquetaActivo activo={fila.activo} /> },
]

const campos = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ayuda: 'Ej. Arriendo, Sueldos, Pago IVA.' },
  {
    clave: 'id_subcategoria',
    etiqueta: 'Subcategoría',
    tipo: 'personalizado',
    render: ({ id, valor, onChange }) => <SelectorSubcategoria id={id} valor={valor} onChange={onChange} />,
  },
  {
    clave: 'monto_default',
    etiqueta: 'Monto por defecto (CLP)',
    tipo: 'numero',
    paso: 1,
    requerido: true,
    ayuda: 'Pre-llena el monto al registrar el gasto; edítalo cuando cambie.',
    validar: (valor) => (valor < 0 ? 'El monto no puede ser negativo.' : undefined),
  },
  {
    clave: 'activo',
    etiqueta: 'Activa',
    tipo: 'booleano',
    ayuda: 'Una plantilla inactiva deja de aparecer en el ingreso rápido, pero conserva sus gastos.',
  },
]

const valoresIniciales = { nombre: '', id_subcategoria: '', monto_default: '', activo: true }

const camposBusqueda = ['nombre', nombreSubcategoria, nombreCategoria]

// Tipos de gasto recurrente (Arriendo, Sueldos, Pago IVA) con su monto habitual.
// Sin filtro "Incompletos": las plantillas no se crean al vuelo.
function Plantillas() {
  return (
    <Mantenedor
      titulo="Plantillas recurrentes"
      descripcion="Gastos que se repiten y su monto habitual. Aparecen como atajos en la pestaña Gastos."
      tabla="plantillas_gastos_recurrentes"
      select={SELECT}
      columnas={columnas}
      campos={campos}
      valoresIniciales={valoresIniciales}
      camposBusqueda={camposBusqueda}
      nombreArchivo="plantillas-gastos-recurrentes"
      tieneActivo
    />
  )
}

export default Plantillas
