import Mantenedor from '../../components/Mantenedor'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'
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

// `qty` no es un campo: el stock lo mueve el trigger de facturas y el formulario
// solo envía las claves declaradas aquí, así que nunca se sobrescribe.
const campos = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  {
    clave: 'id_subcategoria',
    etiqueta: 'Subcategoría',
    tipo: 'personalizado',
    requerido: true,
    render: ({ id, valor, onChange, requerido }) => (
      <SelectorSubcategoria id={id} valor={valor} onChange={onChange} requerido={requerido} />
    ),
  },
  { clave: 'codigo', etiqueta: 'Código', tipo: 'texto' },
  { clave: 'ancho', etiqueta: 'Ancho (mm)', tipo: 'numero' },
  { clave: 'alto', etiqueta: 'Alto (mm)', tipo: 'numero' },
  { clave: 'profundidad', etiqueta: 'Profundidad (mm)', tipo: 'numero' },
  {
    clave: 'venta_directa',
    etiqueta: 'Venta directa',
    tipo: 'booleano',
    anulable: true,
    ayuda: 'Si el insumo también se vende tal como está (ej. scotch, resmas de papel).',
  },
  {
    clave: 'precio_venta',
    etiqueta: 'Precio de venta (CLP)',
    tipo: 'numero',
    paso: 1,
    visible: (valores) => valores.venta_directa === 'true',
  },
  { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
]

const valoresIniciales = {
  nombre: '',
  id_subcategoria: '',
  codigo: '',
  ancho: '',
  alto: '',
  profundidad: '',
  venta_directa: null,
  precio_venta: '',
  descripcion: '',
}

// Campos que la creación al vuelo deja vacíos y no son opcionales por naturaleza
// (las dimensiones no aplican a todos los insumos, ej. tóner).
const esIncompleto = (fila) =>
  estaVacio(fila.codigo) ||
  fila.venta_directa === null ||
  fila.venta_directa === undefined ||
  (fila.venta_directa === true && estaVacio(fila.precio_venta))

const camposBusqueda = ['nombre', 'codigo', nombreSubcategoria, nombreCategoria]

const etiquetaDuplicado = (r) => (nombreSubcategoria(r) ? `${r.nombre} (${nombreSubcategoria(r)})` : r.nombre)

function Insumos() {
  return (
    <Mantenedor
      titulo="Insumos Okima"
      descripcion="Insumos internos. El stock se actualiza solo al ingresar facturas de insumos vinculados."
      tabla="insumos"
      select={SELECT}
      columnas={columnas}
      campos={campos}
      valoresIniciales={valoresIniciales}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="insumos-okima"
      etiquetaDuplicado={etiquetaDuplicado}
      detalle={detalle}
    />
  )
}

export default Insumos
