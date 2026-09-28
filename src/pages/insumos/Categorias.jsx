import EtiquetaActivo from '../../components/EtiquetaActivo'
import Mantenedor from '../../components/Mantenedor'

// subcategorias(count) trae cuántas subcategorías tiene cada categoría en la misma consulta.
const SELECT = '*, subcategorias(count)'

const totalSubcategorias = (fila) => fila.subcategorias?.[0]?.count ?? 0

const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'subcategorias',
    titulo: 'Subcategorías',
    alinear: 'derecha',
    render: totalSubcategorias,
    csv: totalSubcategorias,
  },
  { clave: 'activo', titulo: 'Estado', render: (fila) => <EtiquetaActivo activo={fila.activo} /> },
]

const campos = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  {
    clave: 'activo',
    etiqueta: 'Activa',
    tipo: 'booleano',
    ayuda: 'Una categoría inactiva deja de aparecer en los selectores, pero conserva su historial.',
  },
]

// Sin filtro "Incompletos": las categorías no se crean al vuelo.
function Categorias() {
  return (
    <Mantenedor
      titulo="Categorías"
      descripcion="Centros de costo. Cada uno se desglosa en subcategorías."
      tabla="categorias"
      select={SELECT}
      columnas={columnas}
      campos={campos}
      valoresIniciales={{ nombre: '', activo: true }}
      nombreArchivo="categorias"
      tieneActivo
    />
  )
}

export default Categorias
