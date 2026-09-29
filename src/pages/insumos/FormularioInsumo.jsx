import PaginaRegistro from '../../components/PaginaRegistro'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'

// La subcategoría embebida solo se usa para identificar los parecidos en el aviso de duplicados.
const SELECT = '*, subcategoria:subcategorias(id, nombre)'

// `qty` no es un campo: el stock lo mueve el trigger de facturas y el formulario
// solo envía las claves declaradas aquí, así que nunca se sobrescribe.
// En 2 columnas quedan de a pares: Nombre | Subcategoría, Código solo, Ancho | Alto,
// Profundidad sola, Venta directa | Precio de venta (este solo con "Sí"); la
// descripción ocupa todo el ancho.
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
  { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', completo: true },
  { clave: 'ancho', etiqueta: 'Ancho (mm)', tipo: 'numero' },
  { clave: 'alto', etiqueta: 'Alto (mm)', tipo: 'numero' },
  { clave: 'profundidad', etiqueta: 'Profundidad (mm)', tipo: 'numero' },
  {
    clave: 'venta_directa',
    etiqueta: 'Venta directa',
    tipo: 'booleano',
    anulable: true,
    ayuda: 'Si el insumo también se vende tal como está (ej. scotch, resmas de papel).',
    nuevaFila: true,
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

const etiquetaDuplicado = (r) => (r.subcategoria?.nombre ? `${r.nombre} (${r.subcategoria.nombre})` : r.nombre)

// /insumos/nuevo y /insumos/:id: el formulario del insumo en página propia (no
// modal), con el listado de Insumos Okima como vuelta.
function FormularioInsumo() {
  return (
    <PaginaRegistro
      titulo="insumo Okima"
      tabla="insumos"
      select={SELECT}
      campos={campos}
      valoresIniciales={valoresIniciales}
      rutaListado="/insumos"
      etiquetaDuplicado={etiquetaDuplicado}
    />
  )
}

export default FormularioInsumo
