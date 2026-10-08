import { useMemo } from 'react'
import PaginaRegistro from '../../components/PaginaRegistro'
import { useTabla } from '../../hooks/useTabla'
import { errorSinFilas, mensajeError } from '../../lib/errores'
import { aNumeroDesdeTexto } from '../../lib/numero'
import { campoNotas } from '../../lib/notas'
import { supabase } from '../../lib/supabase'
import { AYUDA_FACTOR, cambiosVinculos, validarVinculos, vinculosEditables } from '../../lib/vinculos'
import EditorVinculos from './EditorVinculos'

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
  vinculos: [],
  notas: '',
}

// Trae los vínculos (filas de la pivote) junto con el registro, para editarlos aquí.
const SELECT = '*, vinculos:insumos_proveedores_okima(id, id_insumo_okima, factor_conversion)'
const SELECT_INSUMOS = 'id, nombre, subcategoria:subcategorias(nombre)'

// Distintos proveedores venden legítimamente el mismo producto: solo se avisa de
// parecidos dentro del mismo proveedor.
const mismoProveedor = (registro, valores) => registro.id_proveedor === valores.id_proveedor

// Los vínculos no son una columna de insumos_proveedores: se guardan aparte.
const sinVinculos = ({ vinculos: _vinculos, ...resto }) => resto

// Guarda los cambios de la lista de vínculos en la pivote: borra, actualiza e
// inserta solo lo que cambió. La base mueve el stock con lo que haya en la pivote
// al guardar una línea de factura; aquí no se toca stock.
async function guardarVinculos(guardado, valores, registro) {
  const { insertar, actualizar, eliminar } = cambiosVinculos(registro?.vinculos, valores.vinculos)
  try {
    if (eliminar.length > 0) {
      const { data, error } = await supabase.from('insumos_proveedores_okima').delete().in('id', eliminar).select('id')
      const fallo = error ?? errorSinFilas(data, eliminar.length)
      if (fallo) throw fallo
    }
    for (const { id, datos } of actualizar) {
      const { data, error } = await supabase.from('insumos_proveedores_okima').update(datos).eq('id', id).select('id')
      const fallo = error ?? errorSinFilas(data)
      if (fallo) throw fallo
    }
    if (insertar.length > 0) {
      const { error } = await supabase
        .from('insumos_proveedores_okima')
        .insert(insertar.map((v) => ({ ...v, id_insumo_proveedor: guardado.id })))
      if (error) throw error
    }
  } catch (e) {
    throw new Error(
      `El insumo del proveedor se guardó, pero no se terminaron de guardar los vínculos (${mensajeError(e)}). ` +
        'Vuelve al listado y ábrelo de nuevo para revisarlos; no lo vuelvas a crear.',
    )
  }
}

// /proveedores/catalogo/nuevo y /proveedores/catalogo/:id: el formulario del
// catálogo en página propia (no modal), con el listado del Catálogo como vuelta.
function FormularioInsumoProveedor() {
  const { filas: proveedores, error: errorProveedores } = useTabla('proveedores', { select: 'id, nombre' })
  const { filas: insumos, cargando: cargandoInsumos, error: errorInsumos } = useTabla('insumos', { select: SELECT_INSUMOS })

  const opcionesInsumos = useMemo(
    () => insumos.map((i) => ({ valor: i.id, etiqueta: i.nombre, detalle: i.subcategoria?.nombre })),
    [insumos],
  )

  // El vínculo a insumos Okima (N:M, con factor de conversión) se edita aquí o en
  // "Por vincular"; nunca se crea al crear el insumo del proveedor al vuelo en
  // Facturas, y desde Facturas solo con confirmación explícita (ver vinculoPropuesto).
  // En 2 columnas quedan de a pares: Proveedor | Nombre, Código | Precio,
  // Formato | Cantidad por formato, Ancho | Alto, Profundidad sola, Fecha de
  // actualización | Link; la descripción y los vínculos ocupan todo el ancho.
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
      ayuda: 'Dato descriptivo del formato de compra. El stock se calcula con el factor de cada vínculo.',
    },
    { clave: 'ancho', etiqueta: 'Ancho (mm)', tipo: 'numero' },
    { clave: 'alto', etiqueta: 'Alto (mm)', tipo: 'numero' },
    { clave: 'profundidad', etiqueta: 'Profundidad (mm)', tipo: 'numero' },
    { clave: 'fecha_actualizacion', etiqueta: 'Fecha de actualización', tipo: 'fecha', nuevaFila: true },
    { clave: 'link_insumo', etiqueta: 'Link', tipo: 'texto' },
    { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
    {
      clave: 'vinculos',
      etiqueta: 'Insumos Okima vinculados',
      tipo: 'personalizado',
      completo: true,
      desdeBase: vinculosEditables,
      validar: (filas) => validarVinculos(filas),
      ayuda: errorInsumos
        ? 'No se pudieron cargar los insumos Okima.'
        : `Al guardar una línea de factura de este insumo, suma stock a cada insumo vinculado. ${AYUDA_FACTOR}`,
      render: ({ id, valor, onChange, valores }) => (
        <EditorVinculos
          id={id}
          valor={valor}
          onChange={onChange}
          opciones={opcionesInsumos}
          cantidadFormato={aNumeroDesdeTexto(valores.cantidad_formato)}
          cargando={cargandoInsumos}
        />
      ),
    },
    campoNotas,
  ]

  return (
    <PaginaRegistro
      titulo="insumo del proveedor"
      entidad="catalogo"
      tabla="insumos_proveedores"
      select={SELECT}
      campos={campos}
      valoresIniciales={valoresIniciales}
      rutaListado="/proveedores/catalogo"
      antesDeGuardar={sinVinculos}
      despuesDeGuardar={guardarVinculos}
      filtroDuplicados={mismoProveedor}
    />
  )
}

export default FormularioInsumoProveedor
