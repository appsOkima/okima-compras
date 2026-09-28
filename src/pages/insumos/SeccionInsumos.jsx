import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/insumos', titulo: 'Insumos', end: true },
  { ruta: '/insumos/categorias', titulo: 'Categorías' },
  { ruta: '/insumos/subcategorias', titulo: 'Subcategorías' },
]

function SeccionInsumos() {
  return <SeccionConPestanas path="/insumos" pestanas={pestanas} />
}

export default SeccionInsumos
