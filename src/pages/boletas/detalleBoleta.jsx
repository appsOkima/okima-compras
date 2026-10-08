import { nombreBoleta } from '../../lib/nombreBoleta'

// Embebidos de la boleta para el listado y la página de detalle. perfil_anulo: quién la
// anuló (la FK anulado_por se nombra para que el embebido no sea ambiguo con created_by).
export const EMBEDS_BOLETA =
  'subcategoria:subcategorias(id, nombre, categoria:categorias(id, nombre)), proveedor:proveedores(id, nombre), plantilla:plantillas_gastos_recurrentes(id, nombre), perfil_anulo:perfiles!anulado_por(nombre_mostrar)'

export const nombreSubcategoria = (fila) => fila.subcategoria?.nombre ?? ''
export const nombreCategoria = (fila) => fila.subcategoria?.categoria?.nombre ?? ''
export const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''
export const nombrePlantilla = (fila) => fila.plantilla?.nombre ?? ''
// El nombre sale de las líneas embebidas (`lineas:detalle_boletas(descripcion, created_at)`):
// la boleta no tiene concepto, ver lib/nombreBoleta.
export const nombreDeBoleta = (fila) => nombreBoleta(fila.lineas)
