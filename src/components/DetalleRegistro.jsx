import { Pencil } from 'lucide-react'
import { estaAnulado } from '../lib/anulacion'
import AvisoAnulado from './AvisoAnulado'
import Notas from './Notas'
import { claseBotonPrimario, claseBotonSecundario } from './estilos'

const VACIO = '—'

// null, undefined o texto vacío se muestran como '—'; el resto tal cual (texto o nodo).
const mostrar = (valor) => (valor === null || valor === undefined || valor === '' ? VACIO : valor)

// Ficha de solo lectura de un registro: lista de definiciones en 2 columnas desde sm.
// detalle = [{ etiqueta, valor: (fila) => texto | número | nodo, completo? }];
// `completo` ocupa todo el ancho (ej. descripciones largas).
// Un documento anulado (estado_documento) muestra su aviso arriba; sin `onEditar` no hay botón Editar.
// Si la fila tiene `notas` con contenido, se destacan arriba de la ficha (ver Notas);
// no hace falta declararlas en `detalle`.
function DetalleRegistro({ detalle, fila, onEditar, onCerrar, tipo = 'boleta' }) {
  return (
    <div className="space-y-4">
      {estaAnulado(fila) && <AvisoAnulado doc={fila} tipo={tipo} />}
      <Notas valor={fila.notas} />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {detalle.map(({ etiqueta, valor, completo }) => (
          <div key={etiqueta} className={completo ? 'sm:col-span-2' : undefined}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
            <dd className="mt-1 break-words text-sm text-slate-800">{mostrar(valor(fila))}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
          Cerrar
        </button>
        {onEditar && (
          <button type="button" onClick={onEditar} className={claseBotonPrimario}>
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        )}
      </div>
    </div>
  )
}

export default DetalleRegistro
