import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/centros-costo', titulo: 'Categorías', end: true },
  { ruta: '/centros-costo/subcategorias', titulo: 'Subcategorías' },
]

function SeccionCentrosCosto() {
  return <SeccionConPestanas path="/centros-costo" pestanas={pestanas} />
}

export default SeccionCentrosCosto
