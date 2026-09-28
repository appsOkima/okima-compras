import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/gastos', titulo: 'Gastos', end: true },
  { ruta: '/gastos/plantillas', titulo: 'Plantillas recurrentes' },
]

function SeccionGastos() {
  return <SeccionConPestanas path="/gastos" pestanas={pestanas} />
}

export default SeccionGastos
