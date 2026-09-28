import EtiquetaActivo from '../../components/EtiquetaActivo'
import Mantenedor from '../../components/Mantenedor'
import { useTabla } from '../../hooks/useTabla'

const SELECT = '*, categoria:categorias(id, nombre)'

const nombreCategoria = (fila) => fila.categoria?.nombre ?? ''

const columnas = [
  { clave: 'categoria', titulo: 'Categoría', render: nombreCategoria, csv: nombreCategoria },
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'descripcion',
    titulo: 'Descripción',
    render: (fila) => <span className="block max-w-md text-slate-600">{fila.descripcion}</span>,
  },
  { clave: 'activo', titulo: 'Estado', render: (fila) => <EtiquetaActivo activo={fila.activo} /> },
]

const camposBusqueda = ['nombre', 'descripcion', nombreCategoria]

// Nombres como "Mantención de Máquinas y Repuestos" se repiten legítimamente en
// varias categorías: solo se avisa de parecidos dentro de la misma categoría.
const mismaCategoria = (registro, valores) => registro.id_categoria === valores.id_categoria

function Subcategorias() {
  const { filas: categorias, error: errorCategorias } = useTabla('categorias', { select: 'id, nombre, activo' })

  // Solo categorías activas, más la actual del registro aunque esté inactiva.
  const campos = (registro) => [
    {
      clave: 'id_categoria',
      etiqueta: 'Categoría',
      tipo: 'seleccion',
      requerido: true,
      opciones: categorias
        .filter((c) => c.activo || c.id === registro?.id_categoria)
        .map((c) => ({ valor: c.id, etiqueta: c.activo ? c.nombre : `${c.nombre} (inactiva)` })),
      ayuda: errorCategorias ? 'No se pudieron cargar las categorías.' : undefined,
    },
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ayuda: 'Ítems incluidos' },
    {
      clave: 'activo',
      etiqueta: 'Activa',
      tipo: 'booleano',
      ayuda: 'Una subcategoría inactiva deja de aparecer en los selectores, pero conserva su historial.',
    },
  ]

  return (
    <Mantenedor
      titulo="Subcategorías"
      descripcion="Desglose de cada categoría. Es lo que se asigna a insumos, gastos y plantillas."
      tabla="subcategorias"
      select={SELECT}
      columnas={columnas}
      campos={campos}
      valoresIniciales={{ id_categoria: '', nombre: '', descripcion: '', activo: true }}
      camposBusqueda={camposBusqueda}
      nombreArchivo="subcategorias"
      tieneActivo
      filtroDuplicados={mismaCategoria}
    />
  )
}

export default Subcategorias
