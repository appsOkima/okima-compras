import SeccionConPestanas from '../../components/SeccionConPestanas'

// El formulario (/facturas/nueva y /facturas/:id) va dentro de la misma sección,
// con las pestañas a la vista.
const pestanas = [
  { ruta: '/facturas', titulo: 'Facturas', end: true },
  { ruta: '/facturas/lineas', titulo: 'Líneas' },
]

function SeccionFacturas() {
  return <SeccionConPestanas path="/facturas" pestanas={pestanas} />
}

export default SeccionFacturas
