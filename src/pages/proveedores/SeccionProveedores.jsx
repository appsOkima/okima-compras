import SeccionConPestanas from '../../components/SeccionConPestanas'

const pestanas = [
  { ruta: '/proveedores', titulo: 'Proveedores', end: true },
  { ruta: '/proveedores/catalogo', titulo: 'Catálogo' },
  { ruta: '/proveedores/por-vincular', titulo: 'Por vincular' },
]

function SeccionProveedores() {
  return <SeccionConPestanas path="/proveedores" pestanas={pestanas} />
}

export default SeccionProveedores
