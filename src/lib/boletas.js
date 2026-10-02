// Reglas de Boletas maestro-detalle: subtotal de línea y total calculados, datos
// de cabecera y líneas para la base, validaciones, cambios de líneas y pre-llenado
// desde una plantilla recurrente (sin React ni Supabase, para poder verificarlas
// con node). Reutiliza el cálculo y el diff de lib/facturas; el stock lo mueve la
// base (detalle_boletas → movimientos_stock), nunca la interfaz.
import { aNumero, diffLineas, subtotalLinea } from './facturas.js'
import { normalizarNotas } from './notas.js'
import { numeroAEditable, numeroDesdeBase } from './numero.js'

// Campos de una línea que escribe la interfaz. subtotal no se ingresa: se calcula.
export const CAMPOS_LINEA_BOLETA = ['descripcion', 'id_insumo_proveedor', 'cantidad', 'precio', 'subtotal']

// round(cantidad × precio) de una línea del formulario; null si falta cantidad o precio.
export const subtotalDeBoleta = (linea) => subtotalLinea(linea?.cantidad, linea?.precio)

// Total de la boleta (lo que se guarda en boletas.monto): Σ subtotales; las
// líneas sin cantidad o precio cuentan 0.
export function totalBoleta(lineas) {
  let suma = 0
  for (const linea of lineas ?? []) suma += subtotalDeBoleta(linea) ?? 0
  return suma
}

// Línea nueva: cantidad 1 por defecto, sin insumo (es opcional).
export function lineaBoletaVacia(clave) {
  return { clave, descripcion: '', id_insumo_proveedor: '', cantidad: '1', precio: '' }
}

// Línea guardada → línea editable (texto de inputs).
export function lineaBoletaDesdeBase(fila) {
  return {
    clave: fila.id,
    id: fila.id,
    descripcion: fila.descripcion ?? '',
    id_insumo_proveedor: fila.id_insumo_proveedor ?? '',
    cantidad: numeroAEditable(fila.cantidad),
    precio: numeroAEditable(fila.precio),
  }
}

// Línea editable → valores para la base (solo CAMPOS_LINEA_BOLETA, conserva el id).
export function datosLineaBoleta(linea) {
  return {
    ...(linea.id ? { id: linea.id } : {}),
    descripcion: String(linea.descripcion ?? '').trim(),
    id_insumo_proveedor: linea.id_insumo_proveedor || null,
    cantidad: aNumero(linea.cantidad),
    precio: aNumero(linea.precio),
    subtotal: subtotalDeBoleta(linea),
  }
}

// Errores de una línea ya convertida con datosLineaBoleta: { campo: mensaje }.
export function erroresLineaBoleta(datos) {
  const errores = {}
  if (!datos.descripcion) errores.descripcion = 'Obligatoria.'
  if (datos.cantidad === null) errores.cantidad = 'Obligatoria.'
  else if (datos.cantidad <= 0) errores.cantidad = 'Debe ser mayor que 0.'
  if (datos.precio === null) errores.precio = 'Obligatorio.'
  else if (datos.precio <= 0) errores.precio = 'Debe ser mayor que 0.'
  return errores
}

// Cabecera editable + líneas → valores para la base. `monto` no se ingresa: es la
// suma de los subtotales de las líneas.
export function datosBoleta(cabecera, lineas) {
  return {
    concepto: String(cabecera.concepto ?? '').trim(),
    id_subcategoria: cabecera.id_subcategoria || null,
    id_proveedor: cabecera.id_proveedor || null,
    fecha: cabecera.fecha || null,
    numero_documento: String(cabecera.numero_documento ?? '').trim() || null,
    notas: normalizarNotas(cabecera.notas),
    monto: totalBoleta(lineas),
  }
}

// Errores de la cabecera ya convertida con datosBoleta: { campo: mensaje }.
export function erroresBoleta(datos) {
  const errores = {}
  if (!datos.concepto) errores.concepto = 'Obligatorio.'
  if (!datos.fecha) errores.fecha = 'Obligatoria.'
  return errores
}

// Cambios a aplicar en las líneas al editar (borrar, actualizar, insertar), igual
// que en facturas pero con los campos de la línea de boleta.
export const diffLineasBoleta = (originales, actuales) => diffLineas(originales, actuales, CAMPOS_LINEA_BOLETA)

// Ingreso rápido: concepto, subcategoría y UNA línea (descripción = nombre de la
// plantilla, cantidad 1, precio = monto por defecto). Monto 0 (valor semilla) deja
// el precio vacío para que se escriba el real.
export function valoresDesdePlantilla(plantilla, claveLinea) {
  const monto = numeroDesdeBase(plantilla?.monto_default)
  return {
    cabecera: { concepto: plantilla?.nombre ?? '', id_subcategoria: plantilla?.id_subcategoria ?? '' },
    lineas: [
      {
        ...lineaBoletaVacia(claveLinea),
        descripcion: plantilla?.nombre ?? '',
        precio: monto > 0 ? numeroAEditable(monto) : '',
      },
    ],
  }
}
