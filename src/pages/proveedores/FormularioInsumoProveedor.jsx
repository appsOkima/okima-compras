import PaginaRegistro from '../../components/PaginaRegistro'
import { useTabla } from '../../hooks/useTabla'

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

// Distintos proveedores venden legítimamente el mismo producto: solo se avisa de
// parecidos dentro del mismo proveedor.
const mismoProveedor = (registro, valores) => registro.id_proveedor === valores.id_proveedor

// /proveedores/catalogo/nuevo y /proveedores/catalogo/:id: el formulario del
// catálogo en página propia (no modal), con el listado del Catálogo como vuelta.
function FormularioInsumoProveedor() {
  const { filas: proveedores, error: errorProveedores } = useTabla('proveedores', { select: 'id, nombre' })

  // `id_insumo_okima` no es un campo: el vínculo se hace en "Por vincular"
  // (revisión semanal del administrador) o, con confirmación, desde una línea de
  // factura asociada a una solicitud; este formulario nunca lo envía.
  // En 2 columnas quedan de a pares: Proveedor | Nombre, Código | Precio,
  // Formato | Cantidad por formato, Ancho | Alto, Profundidad sola, Fecha de
  // actualización | Link; la descripción ocupa todo el ancho.
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
    { clave: 'fecha_actualizacion', etiqueta: 'Fecha de actualización', tipo: 'fecha', nuevaFila: true },
    { clave: 'link_insumo', etiqueta: 'Link', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
  ]

  return (
    <PaginaRegistro
      titulo="insumo del proveedor"
      tabla="insumos_proveedores"
      campos={campos}
      valoresIniciales={valoresIniciales}
      rutaListado="/proveedores/catalogo"
      filtroDuplicados={mismoProveedor}
    />
  )
}

export default FormularioInsumoProveedor
