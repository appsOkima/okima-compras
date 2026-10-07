import { useMemo, useState } from 'react'
import Mantenedor from '../../components/Mantenedor'
import { claseInput } from '../../components/estilos'
import AccionAnulacion from '../../components/AccionAnulacion'
import EtiquetaAnulada from '../../components/EtiquetaAnulada'
import EtiquetaPago from '../../components/EtiquetaPago'
import FiltroEstadoPago from '../../components/FiltroEstadoPago'
import PanelPagos from '../../components/PanelPagos'
import { useEstadosPago } from '../../hooks/useEstadosPago'
import { estaAnulado, vigentes } from '../../lib/anulacion'
import { formatoCLP, formatoFecha } from '../../lib/formato'
import { etiquetaMes, mesDe, mesesPresentes, sumaMontos } from '../../lib/gastos'
import { mensajeBorradoDocumento, textoEstadoPago } from '../../lib/pagos'
import { estaVacio } from '../../lib/texto'
import {
  EMBEDS_BOLETA,
  detalleBoleta,
  nombreBoleta,
  nombreCategoria,
  nombrePlantilla,
  nombreProveedor,
  nombreSubcategoria,
} from './detalleBoleta'
import IngresoRapido from './IngresoRapido'

// La categoría (centro de costo) se obtiene a través de la subcategoría.
const SELECT = `*, ${EMBEDS_BOLETA}, lineas:detalle_boletas(count)`

// Más reciente primero; a igual fecha, el último ingresado arriba.
const ORDEN = { columna: 'fecha', ascendente: false, luego: { columna: 'created_at', ascendente: false } }

// De las líneas basta la cantidad (la ficha las consulta al abrirse).
const numeroLineas = (fila) => fila.lineas?.[0]?.count ?? 0

// Estado de pago de cada boleta (vista_estado_pago, ver useEstadosPago).
const columnasBoletas = (estados) => [
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
  { clave: 'n_lineas', titulo: 'Líneas', alinear: 'derecha', render: numeroLineas, csv: numeroLineas },
  {
    clave: 'estado_documento',
    titulo: 'Estado',
    render: (fila) => (estaAnulado(fila) ? <EtiquetaAnulada /> : ''),
    csv: (fila) => fila.estado_documento ?? 'vigente',
  },
  {
    clave: 'estado_pago',
    titulo: 'Pago',
    render: (fila) => <EtiquetaPago fila={estados.get(fila.id)} />,
    csv: (fila) => textoEstadoPago(estados.get(fila.id)),
  },
  { clave: 'plantilla', titulo: 'Plantilla', soloCsv: true, csv: nombrePlantilla },
  { clave: 'notas', titulo: 'Notas', soloCsv: true },
]

// "Incompletos" = boleta sin centro de costo (sin subcategoría).
const esIncompleto = (fila) => estaVacio(fila.id_subcategoria)

const camposBusqueda = ['concepto', 'numero_documento', nombreProveedor, nombreSubcategoria, nombreCategoria]

// Total de lo que se está mostrando (después de todos los filtros).
// Las anuladas que se muestren no suman ni se cuentan.
const resumen = (filas) => {
  const n = vigentes(filas).length
  return (
    <>
      Total: <span className="font-semibold text-slate-800">{formatoCLP(sumaMontos(filas))}</span> ({n}{' '}
      {n === 1 ? 'boleta' : 'boletas'})
    </>
  )
}

// Boletas: cabecera con sus líneas (arriendo, sueldos, IVA, servicios o compras con
// boleta); el monto es el total de las líneas. Los recurrentes se ingresan desde
// sus plantillas (IngresoRapido).
// Crear y editar (también desde "Ver detalles") abren el formulario en su propia
// página (/boletas/nuevo, /boletas/:id, ver FormularioBoleta), no en un modal.
function Boletas() {
  // '' = todos los meses; si no, 'YYYY-MM'.
  const [mes, setMes] = useState('')
  // '' = todos; si no, pagado | pendiente | parcial.
  const [estadoPago, setEstadoPago] = useState('')
  const { estados, recargar: recargarEstados } = useEstadosPago('boleta')
  const columnas = useMemo(() => columnasBoletas(estados), [estados])
  // La ficha suma la pestaña Cuotas/Pagos; al tocar los pagos se refresca el listado.
  const detalle = useMemo(
    () => [
      ...detalleBoleta,
      {
        etiqueta: 'Cuotas/Pagos',
        completo: true,
        valor: (fila) => <PanelPagos tipo="boleta" documento={fila} onCambio={recargarEstados} />,
      },
    ],
    [recargarEstados],
  )

  // Filtros por mes y por estado de pago: se aplican antes de la búsqueda y de "Incompletos".
  const filtroMes = useMemo(
    () => ({
      activo: mes !== '' || estadoPago !== '',
      aplica:
        mes || estadoPago
          ? (fila) =>
              (!mes || mesDe(fila.fecha) === mes) && (!estadoPago || estados.get(fila.id)?.estado_pago === estadoPago)
          : undefined,
      render: (filas) => {
        const meses = mesesPresentes(filas)
        // Si se borró el última boleta del mes elegido, la opción se mantiene.
        if (mes && !meses.includes(mes)) meses.unshift(mes)
        return (
          <>
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
            <FiltroEstadoPago valor={estadoPago} onChange={setEstadoPago} />
          </>
        )
      },
    }),
    [mes, estadoPago, estados],
  )

  return (
    <Mantenedor
      titulo="Boletas"
      descripcion="Boletas con sus líneas (arriendo, sueldos, pago de IVA, servicios), del más reciente al más antiguo."
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
      tieneAnulados
      mensajeBorrado={mensajeBorradoDocumento}
      accionesFila={(fila, { actualizar }) => (
        <AccionAnulacion
          tipo="boleta"
          doc={fila}
          nombre={fila.concepto}
          onCambiar={async (datos) => {
            await actualizar(fila.id, datos)
            recargarEstados()
          }}
        />
      )}
    />
  )
}

export default Boletas
