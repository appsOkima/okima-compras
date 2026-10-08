import { formatoCLP, formatoFecha, formatoFechaLocal } from '../../lib/formato'
import { nombreBoleta } from '../../lib/nombreBoleta'
import LineasBoleta from './LineasBoleta'

// Embebidos de la boleta para el listado y la ficha. perfil_anulo: quién la anuló
// (la FK anulado_por se nombra para que el embebido no sea ambiguo con created_by).
export const EMBEDS_BOLETA =
  'subcategoria:subcategorias(id, nombre, categoria:categorias(id, nombre)), proveedor:proveedores(id, nombre), plantilla:plantillas_gastos_recurrentes(id, nombre), perfil_anulo:perfiles!anulado_por(nombre_mostrar)'

export const nombreSubcategoria = (fila) => fila.subcategoria?.nombre ?? ''
export const nombreCategoria = (fila) => fila.subcategoria?.categoria?.nombre ?? ''
export const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''
export const nombrePlantilla = (fila) => fila.plantilla?.nombre ?? ''
// El nombre sale de las líneas embebidas (`lineas:detalle_boletas(descripcion, created_at)`):
// la boleta no tiene concepto, ver lib/nombreBoleta.
export const nombreDeBoleta = (fila) => nombreBoleta(fila.lineas)

// Ficha de "Ver detalles" (y vista de solo lectura de una boleta anulada): todos los
// campos de la boleta. El aviso de anulación lo pone DetalleRegistro.
export const detalleBoleta = [
  { etiqueta: 'Fecha', valor: (fila) => formatoFecha(fila.fecha) },
  { etiqueta: 'Total', valor: (fila) => formatoCLP(fila.monto) },
  { etiqueta: 'Categoría (centro de costo)', valor: nombreCategoria },
  { etiqueta: 'Subcategoría', valor: nombreSubcategoria },
  { etiqueta: 'Proveedor', valor: nombreProveedor },
  { etiqueta: 'N° documento', valor: (fila) => fila.numero_documento },
  { etiqueta: 'Plantilla de origen', valor: nombrePlantilla },
  { etiqueta: 'Creado', valor: (fila) => formatoFechaLocal(fila.created_at) },
  { etiqueta: 'Líneas', completo: true, valor: (fila) => <LineasBoleta boleta={fila} /> },
  // Las notas no van aquí: DetalleRegistro las destaca arriba de la ficha.
]
