import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PaginaDetalleDocumento from '../../components/PaginaDetalleDocumento'
import Notas from '../../components/Notas'
import PanelPagos from '../../components/PanelPagos'
import { claseTarjeta } from '../../components/estilos'
import { useAuth } from '../../auth/contexto'
import { useEstadosPago } from '../../hooks/useEstadosPago'
import { estaAnulado } from '../../lib/anulacion'
import { solicitudesDeBoleta } from '../../lib/cargarSolicitudes'
import { errorSinFilas } from '../../lib/errores'
import { formatoCLP, formatoFecha, formatoFechaLocal } from '../../lib/formato'
import { puedeHacer } from '../../lib/permisos'
import { supabase } from '../../lib/supabase'
import {
  EMBEDS_BOLETA,
  nombreCategoria,
  nombreDeBoleta,
  nombrePlantilla,
  nombreProveedor,
  nombreSubcategoria,
} from './detalleBoleta'
import LineasBoleta from './LineasBoleta'

// El nombre de la boleta sale de sus líneas embebidas (no tiene concepto).
const SELECT_BOLETA = `*, ${EMBEDS_BOLETA}, lineas:detalle_boletas(descripcion, created_at)`

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children === null || children === undefined || children === '' ? '—' : children}</dd>
    </div>
  )
}

// /boletas/:id/detalle: "Ver detalles" de una boleta en pantalla completa (antes una
// modal): datos, líneas y Cuotas/Pagos. Anular/reactivar y los pagos recargan la página
// sin salir de ella.
function PaginaDetalleBoleta() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const { estados, recargar: recargarEstados } = useEstadosPago('boleta')
  // 'cargando' | 'lista' | 'no-encontrada' | 'error'
  const [carga, setCarga] = useState('cargando')
  const [errorCarga, setErrorCarga] = useState(null)
  const [boleta, setBoleta] = useState(null)
  // Cada cambio de `version` repite la consulta (tras anular o reactivar).
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    supabase
      .from('boletas')
      .select(SELECT_BOLETA)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error || !data) {
          // 22P02: el id de la URL no es un uuid válido.
          setCarga(!error || error.code === '22P02' ? 'no-encontrada' : 'error')
          setErrorCarga(error)
          return
        }
        setBoleta(data)
        setCarga('lista')
      })
    return () => {
      vigente = false
    }
  }, [id, version])

  const cambiarEstado = useCallback(
    async (datos) => {
      const { data, error } = await supabase.from('boletas').update(datos).eq('id', id).select('id')
      const fallo = error ?? errorSinFilas(data)
      if (fallo) throw fallo
      setVersion((v) => v + 1)
      recargarEstados()
    },
    [id, recargarEstados],
  )

  const puedeEditar = puedeHacer(perfil?.rol, 'boletas', 'editar')
  const nombre = boleta ? nombreDeBoleta(boleta) : ''

  return (
    <PaginaDetalleDocumento
      tipo="boleta"
      rutaListado="/boletas"
      carga={carga}
      errorCarga={errorCarga}
      doc={boleta}
      titulo={boleta && `${nombre} — ${formatoFecha(boleta.fecha)}`}
      nombre={nombre}
      estadoPago={estados.get(id)}
      rutaEditar={puedeEditar && boleta && !estaAnulado(boleta) ? `/boletas/${id}` : undefined}
      onCambiar={cambiarEstado}
      cargarSolicitudes={solicitudesDeBoleta}
    >
      {boleta && (
        <>
          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Datos de la boleta</h3>
            <div className="space-y-4">
              <Notas valor={boleta.notas} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                <Dato etiqueta="Fecha">{formatoFecha(boleta.fecha)}</Dato>
                <Dato etiqueta="Total">
                  <span className="font-semibold">{formatoCLP(boleta.monto)}</span>
                </Dato>
                <Dato etiqueta="N° documento">{boleta.numero_documento}</Dato>
                <Dato etiqueta="Proveedor">{nombreProveedor(boleta)}</Dato>
                <Dato etiqueta="Categoría (centro de costo)">{nombreCategoria(boleta)}</Dato>
                <Dato etiqueta="Subcategoría">{nombreSubcategoria(boleta)}</Dato>
                <Dato etiqueta="Plantilla de origen">{nombrePlantilla(boleta)}</Dato>
                <Dato etiqueta="Creada">{formatoFechaLocal(boleta.created_at)}</Dato>
              </dl>
            </div>
          </div>

          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Líneas</h3>
            <LineasBoleta boleta={boleta} />
          </div>

          <div className={claseTarjeta}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cuotas / Pagos</h3>
            <PanelPagos tipo="boleta" documento={boleta} onCambio={recargarEstados} />
          </div>
        </>
      )}
    </PaginaDetalleDocumento>
  )
}

export default PaginaDetalleBoleta
