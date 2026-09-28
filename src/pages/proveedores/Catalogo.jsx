import Mantenedor from '../../components/Mantenedor'
import { useTabla } from '../../hooks/useTabla'
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

const valoresIniciales = {
  id_proveedor: '',
  nombre: '',
  codigo: '',
  precio_clp: '',
  ancho: '',
  alto: '',
  profundidad: '',
  cantidad_formato: '',
  formato_unidad: '',
  fecha_actualizacion: '',
  link_insumo: '',
  descripcion: '',
}

const esIncompleto = (fila) =>
  estaVacio(fila.codigo) ||
  estaVacio(fila.precio_clp) ||
  estaVacio(fila.cantidad_formato) ||
  estaVacio(fila.formato_unidad)

const camposBusqueda = ['nombre', 'codigo', nombreProveedor]

// Distintos proveedores venden legítimamente el mismo producto: solo se avisa de
// parecidos dentro del mismo proveedor.
const mismoProveedor = (registro, valores) => registro.id_proveedor === valores.id_proveedor

function Catalogo() {
  const { filas: proveedores, error: errorProveedores } = useTabla('proveedores', { select: 'id, nombre' })

  // `id_insumo_okima` no es un campo: el vínculo se hace en "Por vincular"
  // (revisión semanal del administrador) o, con confirmación, desde una línea de
  // factura asociada a una solicitud; este formulario nunca lo envía.
  const campos = [
    {
      clave: 'id_proveedor',
      etiqueta: 'Proveedor',
      tipo: 'seleccion',
      requerido: true,
      opciones: proveedores.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
      ayuda: errorProveedores ? 'No se pudieron cargar los proveedores.' : undefined,
    },
    { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ayuda: 'Tal como lo nombra el proveedor.' },
    { clave: 'codigo', etiqueta: 'Código', tipo: 'texto' },
    { clave: 'precio_clp', etiqueta: 'Precio (CLP)', tipo: 'numero', paso: 1 },
    { clave: 'formato_unidad', etiqueta: 'Formato de compra', tipo: 'texto', ayuda: 'Ej. "caja", "rollo", "resma".' },
    {
      clave: 'cantidad_formato',
      etiqueta: 'Cantidad por formato',
      tipo: 'numero',
      ayuda: 'Unidades internas por formato de compra.',
    },
    { clave: 'ancho', etiqueta: 'Ancho (mm)', tipo: 'numero' },
    { clave: 'alto', etiqueta: 'Alto (mm)', tipo: 'numero' },
    { clave: 'profundidad', etiqueta: 'Profundidad (mm)', tipo: 'numero' },
    { clave: 'fecha_actualizacion', etiqueta: 'Fecha de actualización', tipo: 'fecha' },
    { clave: 'link_insumo', etiqueta: 'Link', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
  ]

  return (
    <Mantenedor
      titulo="Catálogo"
      descripcion="Insumos tal como los vende cada proveedor, con su precio y formato de compra."
      tabla="insumos_proveedores"
      select={SELECT}
      columnas={columnas}
      campos={campos}
      valoresIniciales={valoresIniciales}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="catalogo-proveedores"
      filtroDuplicados={mismoProveedor}
    />
  )
}

export default Catalogo
