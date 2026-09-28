import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/solicitudes', titulo: 'Pendientes', end: true },
  { ruta: '/solicitudes/compradas', titulo: 'Compradas' },
  { ruta: '/solicitudes/canceladas', titulo: 'Canceladas' },
  { ruta: '/solicitudes/todas', titulo: 'Todas' },
]

function SeccionSolicitudes() {
  return <SeccionConPestanas path="/solicitudes" pestanas={pestanas} />
}

export default SeccionSolicitudes
