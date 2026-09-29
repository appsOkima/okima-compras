import Mantenedor from '../../components/Mantenedor'
import { formatoCLP, formatoDimensiones, formatoFechaLocal, formatoNumero } from '../../lib/formato'
import { estaVacio } from '../../lib/texto'

// La categoría (centro de costo) se obtiene a través de la subcategoría.
const SELECT = '*, subcategoria:subcategorias(id, nombre, categoria:categorias(id, nombre))'

const nombreSubcategoria = (fila) => fila.subcategoria?.nombre ?? ''
const nombreCategoria = (fila) => fila.subcategoria?.categoria?.nombre ?? ''

const textoVentaDirecta = (fila) =>
  fila.venta_directa === true ? 'Sí' : fila.venta_directa === false ? 'No' : 'Sin definir'

// Tabla compacta: categoría, dimensiones, venta directa y descripción se consultan
// en "Ver detalles", pero el CSV sigue exportándolas todas (columnas soloCsv).
const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'categoria', titulo: 'Categoría', soloCsv: true, csv: nombreCategoria },
  { clave: 'subcategoria', titulo: 'Subcategoría', render: nombreSubcategoria, csv: nombreSubcategoria },
  { clave: 'ancho', titulo: 'Ancho (mm)', soloCsv: true },
  { clave: 'alto', titulo: 'Alto (mm)', soloCsv: true },
  { clave: 'profundidad', titulo: 'Profundidad (mm)', soloCsv: true },
  { clave: 'venta_directa', titulo: 'Venta directa', soloCsv: true },
  {
    clave: 'precio_venta',
    titulo: 'Precio venta',
    alinear: 'derecha',
    render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.precio_venta)}</span>,
  },
  { clave: 'qty', titulo: 'Stock', alinear: 'derecha', render: (fila) => formatoNumero(fila.qty) },
  { clave: 'descripcion', titulo: 'Descripción', soloCsv: true },
]

// Ficha de "Ver detalles": todos los campos del insumo.
const detalle = [
  { etiqueta: 'Nombre', valor: (fila) => fila.nombre, completo: true },
  { etiqueta: 'Código', valor: (fila) => fila.codigo },
  { etiqueta: 'Stock', valor: (fila) => formatoNumero(fila.qty) },
  { etiqueta: 'Categoría (centro de costo)', valor: nombreCategoria },
  { etiqueta: 'Subcategoría', valor: nombreSubcategoria },
  {
    etiqueta: 'Dimensiones (ancho × alto × prof.)',
    valor: (fila) => formatoDimensiones(fila.ancho, fila.alto, fila.profundidad),
  },
  { etiqueta: 'Venta directa', valor: textoVentaDirecta },
  { etiqueta: 'Precio de venta', valor: (fila) => formatoCLP(fila.precio_venta) },
  { etiqueta: 'Creado', valor: (fila) => formatoFechaLocal(fila.created_at) },
  {
    etiqueta: 'Descripción',
    completo: true,
    // whitespace-pre-line conserva los saltos de línea escritos en el formulario.
    valor: (fila) =>
      estaVacio(fila.descripcion) ? null : <span className="whitespace-pre-line">{fila.descripcion}</span>,
  },
]

// Campos que la creación al vuelo deja vacíos y no son opcionales por naturaleza
// (las dimensiones no aplican a todos los insumos, ej. tóner).
const esIncompleto = (fila) =>
  estaVacio(fila.codigo) ||
  fila.venta_directa === null ||
  fila.venta_directa === undefined ||
  (fila.venta_directa === true && estaVacio(fila.precio_venta))

const camposBusqueda = ['nombre', 'codigo', nombreSubcategoria, nombreCategoria]

// Crear y editar abren el formulario en su propia página (/insumos/nuevo,
// /insumos/:id, ver FormularioInsumo), no en un modal.
function Insumos() {
  return (
    <Mantenedor
      titulo="Insumos Okima"
      descripcion="Insumos internos. El stock se actualiza solo al ingresar facturas de insumos vinculados."
      tabla="insumos"
      select={SELECT}
      columnas={columnas}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="insumos-okima"
      detalle={detalle}
      rutaFormulario="/insumos"
    />
  )
}

export default Insumos
