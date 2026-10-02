import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/boletas', titulo: 'Boletas', end: true },
  { ruta: '/boletas/plantillas', titulo: 'Plantillas recurrentes' },
]

function SeccionBoletas() {
  return <SeccionConPestanas path="/boletas" pestanas={pestanas} />
}

export default SeccionBoletas
