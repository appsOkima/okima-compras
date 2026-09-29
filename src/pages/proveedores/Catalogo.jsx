import Mantenedor from '../../components/Mantenedor'
import { formatoCLP, formatoCompra, formatoFecha } from '../../lib/formato'
import { estaVacio } from '../../lib/texto'

const SELECT = '*, proveedor:proveedores(id, nombre), insumo_okima:insumos(id, nombre)'

const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''
const nombreInsumoOkima = (fila) => fila.insumo_okima?.nombre ?? ''

const columnas = [
  { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'codigo', titulo: 'Código' },
  {
    clave: 'precio_clp',
    titulo: 'Precio',
    alinear: 'derecha',
    render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.precio_clp)}</span>,
  },
  {
    clave: 'formato',
    titulo: 'Formato',
    soloTabla: true,
    render: (fila) => formatoCompra(fila.cantidad_formato, fila.formato_unidad),
  },
  { clave: 'formato_unidad', titulo: 'Formato unidad', soloCsv: true },
  { clave: 'cantidad_formato', titulo: 'Cantidad por formato', soloCsv: true },
  {
    clave: 'insumo_okima',
    titulo: 'Insumo Okima',
    csv: nombreInsumoOkima,
    render: (fila) =>
      fila.insumo_okima ? (
        nombreInsumoOkima(fila)
      ) : (
        <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Sin vincular
        </span>
      ),
  },
  {
    clave: 'fecha_actualizacion',
    titulo: 'Actualizado',
    render: (fila) => <span className="whitespace-nowrap">{formatoFecha(fila.fecha_actualizacion)}</span>,
  },
  { clave: 'ancho', titulo: 'Ancho (mm)', soloCsv: true },
  { clave: 'alto', titulo: 'Alto (mm)', soloCsv: true },
  { clave: 'profundidad', titulo: 'Profundidad (mm)', soloCsv: true },
  { clave: 'link_insumo', titulo: 'Link', soloCsv: true },
  { clave: 'descripcion', titulo: 'Descripción', soloCsv: true },
]

const esIncompleto = (fila) =>
  estaVacio(fila.codigo) ||
  estaVacio(fila.precio_clp) ||
  estaVacio(fila.cantidad_formato) ||
  estaVacio(fila.formato_unidad)

const camposBusqueda = ['nombre', 'codigo', nombreProveedor]

// Crear y editar abren el formulario en su propia página (/proveedores/catalogo/nuevo,
// /proveedores/catalogo/:id, ver FormularioInsumoProveedor), no en un modal.
function Catalogo() {
  return (
    <Mantenedor
      titulo="Catálogo"
      descripcion="Insumos tal como los vende cada proveedor, con su precio y formato de compra."
      tabla="insumos_proveedores"
      select={SELECT}
      columnas={columnas}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="catalogo-proveedores"
      rutaFormulario="/proveedores/catalogo"
    />
  )
}

export default Catalogo
