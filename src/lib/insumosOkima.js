// Lógica pura del selector de insumo Okima con creación al vuelo.

// Opciones del Combobox. `excluir` (Set de ids) oculta los ya usados, salvo `conservar`.
export function opcionesInsumosOkima(insumos, excluir = new Set(), conservar = '') {
  return insumos
    .filter((i) => i.id === conservar || !excluir.has(i.id))
    .map((i) => ({ valor: i.id, etiqueta: i.nombre, detalle: i.subcategoria?.nombre }))
}

// Valida el mini-formulario de creación. Un insumo creado al vuelo lleva solo
// nombre e id_subcategoria (ambos obligatorios); el resto lo completa el admin.
export function valoresNuevoInsumo({ nombre, id_subcategoria }) {
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio || !id_subcategoria) return { error: 'Completa el nombre y la subcategoría.', valores: null }
  return { error: null, valores: { nombre: limpio, id_subcategoria } }
}
