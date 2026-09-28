import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/solicitudes', titulo: 'Pendientes', end: true },
  { ruta: '/solicitudes/todas', titulo: 'Todas' },
]

function SeccionSolicitudes() {
  return <SeccionConPestanas path="/solicitudes" pestanas={pestanas} />
}

export default SeccionSolicitudes
