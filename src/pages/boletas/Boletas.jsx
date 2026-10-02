import { useMemo, useState } from 'react'
import Mantenedor from '../../components/Mantenedor'
import { claseInput } from '../../components/estilos'
import { formatoCLP, formatoFecha, formatoFechaLocal } from '../../lib/formato'
import { etiquetaMes, mesDe, mesesPresentes, sumaMontos } from '../../lib/gastos'
import { estaVacio } from '../../lib/texto'
import IngresoRapido from './IngresoRapido'

// La categoría (centro de costo) se obtiene a través de la subcategoría.
const SELECT =
  '*, subcategoria:subcategorias(id, nombre, categoria:categorias(id, nombre)), proveedor:proveedores(id, nombre), plantilla:plantillas_gastos_recurrentes(id, nombre)'

// Más reciente primero; a igual fecha, el último ingresado arriba.
const ORDEN = { columna: 'fecha', ascendente: false, luego: { columna: 'created_at', ascendente: false } }

const nombreSubcategoria = (fila) => fila.subcategoria?.nombre ?? ''
const nombreCategoria = (fila) => fila.subcategoria?.categoria?.nombre ?? ''
const nombreProveedor = (fila) => fila.proveedor?.nombre ?? ''
const nombrePlantilla = (fila) => fila.plantilla?.nombre ?? ''

const columnas = [
  {
    clave: 'fecha',
    titulo: 'Fecha',
    render: (fila) => <span className="whitespace-nowrap">{formatoFecha(fila.fecha)}</span>,
  },
  { clave: 'concepto', titulo: 'Concepto' },
  { clave: 'categoria', titulo: 'Categoría', soloCsv: true, csv: nombreCategoria },
  { clave: 'subcategoria', titulo: 'Subcategoría', render: nombreSubcategoria, csv: nombreSubcategoria },
  { clave: 'proveedor', titulo: 'Proveedor', render: nombreProveedor, csv: nombreProveedor },
  {
    clave: 'monto',
    titulo: 'Monto',
    alinear: 'derecha',
    render: (fila) => <span className="whitespace-nowrap">{formatoCLP(fila.monto)}</span>,
  },
  { clave: 'numero_documento', titulo: 'N° documento' },
  { clave: 'plantilla', titulo: 'Plantilla', soloCsv: true, csv: nombrePlantilla },
  { clave: 'notas', titulo: 'Notas', soloCsv: true },
]

// Ficha de "Ver detalles": todos los campos de la boleta.
const detalle = [
  { etiqueta: 'Concepto', valor: (fila) => fila.concepto, completo: true },
  { etiqueta: 'Fecha', valor: (fila) => formatoFecha(fila.fecha) },
  { etiqueta: 'Monto', valor: (fila) => formatoCLP(fila.monto) },
  { etiqueta: 'Categoría (centro de costo)', valor: nombreCategoria },
  { etiqueta: 'Subcategoría', valor: nombreSubcategoria },
  { etiqueta: 'Proveedor', valor: nombreProveedor },
  { etiqueta: 'N° documento', valor: (fila) => fila.numero_documento },
  { etiqueta: 'Plantilla de origen', valor: nombrePlantilla },
  { etiqueta: 'Creado', valor: (fila) => formatoFechaLocal(fila.created_at) },
  {
    etiqueta: 'Notas',
    completo: true,
    // whitespace-pre-line conserva los saltos de línea escritos en el formulario.
    valor: (fila) => (estaVacio(fila.notas) ? null : <span className="whitespace-pre-line">{fila.notas}</span>),
  },
]

// "Incompletos" = boleta sin centro de costo (sin subcategoría).
const esIncompleto = (fila) => estaVacio(fila.id_subcategoria)

const camposBusqueda = ['concepto', 'numero_documento', nombreProveedor, nombreSubcategoria, nombreCategoria]

const nombreBoleta = (fila) => fila.concepto

// Total de lo que se está mostrando (después de todos los filtros).
const resumen = (filas) => (
  <>
    Total: <span className="font-semibold text-slate-800">{formatoCLP(sumaMontos(filas))}</span> ({filas.length}{' '}
    {filas.length === 1 ? 'boleta' : 'boletas'})
  </>
)

// Boletas: gastos que no son compra de insumos con stock (arriendo, sueldos, IVA,
// servicios). Los recurrentes se ingresan desde sus plantillas (IngresoRapido).
// Crear y editar (también desde "Ver detalles") abren el formulario en su propia
// página (/boletas/nuevo, /boletas/:id, ver FormularioBoleta), no en un modal.
function Boletas() {
  // '' = todos los meses; si no, 'YYYY-MM'.
  const [mes, setMes] = useState('')

  // Filtro por mes: se aplica antes de la búsqueda y de "Incompletos".
  const filtroMes = useMemo(
    () => ({
      activo: mes !== '',
      aplica: mes ? (fila) => mesDe(fila.fecha) === mes : undefined,
      render: (filas) => {
        const meses = mesesPresentes(filas)
        // Si se borró el última boleta del mes elegido, la opción se mantiene.
        if (mes && !meses.includes(mes)) meses.unshift(mes)
        return (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Mes
            <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${claseInput} w-auto`}>
              <option value="">Todos</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {etiquetaMes(m)}
                </option>
              ))}
            </select>
          </label>
        )
      },
    }),
    [mes],
  )

  return (
    <Mantenedor
      titulo="Boletas"
      descripcion="Boletas sin stock (arriendo, sueldos, pago de IVA, servicios), del más reciente al más antiguo."
      tabla="boletas"
      select={SELECT}
      orden={ORDEN}
      columnas={columnas}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="boletas"
      detalle={detalle}
      nombreRegistro={nombreBoleta}
      filtroExtra={filtroMes}
      resumen={resumen}
      antesDeTabla={() => <IngresoRapido />}
      rutaFormulario="/boletas"
    />
  )
}

export default Boletas
