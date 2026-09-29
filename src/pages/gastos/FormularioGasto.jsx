import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PaginaRegistro from '../../components/PaginaRegistro'
import SelectorSubcategoria from '../../components/SelectorSubcategoria'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import { formatoCLP, formatoFecha } from '../../lib/formato'
import { etiquetaMes, gastosDePlantillaEnMes, mesDe } from '../../lib/gastos'
import { hoyISO } from '../../lib/solicitudes'
import SelectorProveedor from './SelectorProveedor'

// otros_gastos no tiene `nombre` (el orden por defecto de useTabla).
const ORDEN = { columna: 'fecha', ascendente: false }

const SELECT_PLANTILLAS = 'id, nombre, id_subcategoria, monto_default'

const nombreGasto = (fila) => fila.concepto

const etiquetaGasto = (g) => `${g.concepto} — ${formatoFecha(g.fecha)} — ${formatoCLP(g.monto)}`

// /gastos/nuevo y /gastos/:id: el formulario del gasto en página propia (no
// modal), con el listado de Gastos como vuelta.
// Ingreso rápido de gasto recurrente: /gastos/nuevo?plantilla=<id> (desde los
// atajos del listado, ver IngresoRapido) pre-llena concepto, subcategoría y
// monto desde la plantilla, guarda `id_plantilla_recurrente` y avisa si esa
// plantilla ya tiene gasto en el mes de la fecha elegida. Si la plantilla no
// existe se muestra el error con el enlace al listado (no un gasto en blanco,
// que perdería el vínculo con la plantilla sin que se note). Al editar se ignora.
function FormularioGasto() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const idPlantilla = id ? null : parametros.get('plantilla')

  const {
    filas: proveedores,
    cargando: cargandoProveedores,
    error: errorProveedores,
  } = useTabla('proveedores', { select: 'id, nombre, rut' })
  // Tabla corta: se cargan todas y se busca la pedida (incluye las inactivas).
  const {
    filas: plantillas,
    cargando: cargandoPlantillas,
    error: errorPlantillas,
  } = useTabla('plantillas_gastos_recurrentes', { select: SELECT_PLANTILLAS })

  const plantilla = idPlantilla ? (plantillas.find((p) => p.id === idPlantilla) ?? null) : null

  const opcionesProveedores = useMemo(
    () => proveedores.map((p) => ({ valor: p.id, etiqueta: p.nombre, detalle: p.rut })),
    [proveedores],
  )

  // id_plantilla_recurrente no es un campo: lo agrega antesDeGuardar al crear
  // desde una plantilla y, al editar, el formulario no lo envía, así que se conserva.
  // En 2 columnas quedan de a pares: Concepto | Monto, Fecha | Subcategoría,
  // Proveedor | N° documento; las notas ocupan todo el ancho.
  const campos = useMemo(
    () => [
      { clave: 'concepto', etiqueta: 'Concepto', tipo: 'texto', requerido: true },
      {
        clave: 'monto',
        etiqueta: 'Monto (CLP)',
        tipo: 'numero',
        paso: 1,
        requerido: true,
        validar: (valor) => (valor <= 0 ? 'El monto debe ser mayor que 0.' : undefined),
      },
      {
        clave: 'fecha',
        etiqueta: 'Fecha',
        tipo: 'fecha',
        requerido: true,
        ayuda: 'Por defecto hoy; se puede registrar un gasto de una fecha pasada.',
      },
      {
        clave: 'id_subcategoria',
        etiqueta: 'Subcategoría (centro de costo)',
        tipo: 'personalizado',
        render: ({ id: idCampo, valor, onChange }) => (
          <SelectorSubcategoria id={idCampo} valor={valor} onChange={onChange} />
        ),
      },
      {
        clave: 'id_proveedor',
        etiqueta: 'Proveedor',
        tipo: 'personalizado',
        render: ({ id: idCampo, valor, onChange }) => (
          <SelectorProveedor
            id={idCampo}
            valor={valor}
            onChange={onChange}
            opciones={opcionesProveedores}
            cargando={cargandoProveedores}
            error={errorProveedores}
          />
        ),
      },
      { clave: 'numero_documento', etiqueta: 'N° documento', tipo: 'texto' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'area' },
    ],
    [opcionesProveedores, cargandoProveedores, errorProveedores],
  )

  const valoresIniciales = {
    concepto: plantilla?.nombre ?? '',
    id_subcategoria: plantilla?.id_subcategoria ?? '',
    // Monto 0 (valor semilla) se deja vacío para que se escriba el real.
    monto: Number(plantilla?.monto_default) > 0 ? plantilla.monto_default : '',
    fecha: hoyISO(),
    id_proveedor: '',
    numero_documento: '',
    notas: '',
  }

  // Solo con plantilla: la página espera a tenerla y usa su aviso de "ya registrado".
  let errorPlantilla
  if (idPlantilla && !cargandoPlantillas) {
    if (errorPlantillas) errorPlantilla = `No se pudo cargar la plantilla: ${mensajeError(errorPlantillas)}`
    else if (!plantilla) errorPlantilla = 'No se encontró la plantilla de gasto recurrente (puede que se haya eliminado).'
  }

  const conPlantilla = plantilla
    ? {
        tituloNuevo: `Registrar gasto: ${plantilla.nombre}`,
        descripcion: 'Pre-llenado desde la plantilla recurrente: revisa el monto y confirma la fecha.',
        antesDeGuardar: (valores) => ({ ...valores, id_plantilla_recurrente: plantilla.id }),
        // Primer clic: avisa si esta plantilla ya tiene gasto en el mes de la fecha elegida.
        buscarDuplicados: (valores, { filas }) => gastosDePlantillaEnMes(filas, plantilla.id, valores.fecha),
        etiquetaDuplicado: etiquetaGasto,
        textoDuplicados: (lista) => `Ya registraste ${plantilla.nombre} en ${etiquetaMes(mesDe(lista[0]?.fecha))}:`,
      }
    : {}

  return (
    <PaginaRegistro
      // key: otra plantilla (otra búsqueda en la URL) parte con un formulario nuevo.
      key={idPlantilla ?? ''}
      titulo="gasto"
      tabla="otros_gastos"
      orden={ORDEN}
      campos={campos}
      valoresIniciales={valoresIniciales}
      rutaListado="/gastos"
      nombreRegistro={nombreGasto}
      duplicadosPorNombre={false}
      cargandoExtra={Boolean(idPlantilla) && cargandoPlantillas}
      errorExtra={errorPlantilla}
      {...conPlantilla}
    />
  )
}

export default FormularioGasto
