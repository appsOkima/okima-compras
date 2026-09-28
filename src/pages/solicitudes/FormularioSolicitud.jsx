import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import FormularioRegistro from '../../components/FormularioRegistro'
import { useTabla } from '../../hooks/useTabla'
import { mensajeError } from '../../lib/errores'
import {
  NIVELES_URGENCIA,
  URGENCIA_POR_DEFECTO,
  guardarUltimoSolicitante,
  leerUltimoSolicitante,
  metaUrgencia,
  solicitantesUnicos,
} from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import SelectorInsumo from './SelectorInsumo'

const SELECT_INSUMOS = 'id, nombre, subcategoria:subcategorias(nombre)'

// Crear o editar una solicitud (registro = null → nueva). El estado no se toca
// aquí: nace 'Pendiente' (default de la base) y 'Comprada' la pone el trigger de
// facturas; cancelar y reactivar son acciones aparte en las listas.
function FormularioSolicitud({ registro, onGuardar, onCancelar }) {
  const { filas: insumos, cargando, error, crear: crearInsumo } = useTabla('insumos', { select: SELECT_INSUMOS })
  const [solicitantes, setSolicitantes] = useState([])

  // Sin tabla de empleados: se sugieren los solicitantes ya usados (el más
  // reciente primero, para conservar su forma de escribir el nombre).
  useEffect(() => {
    let vigente = true
    supabase
      .from('solicitudes_compra')
      .select('solicitante')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        // Si falla, el campo sigue siendo texto libre, sin sugerencias.
        if (vigente) setSolicitantes(solicitantesUnicos((data ?? []).map((f) => f.solicitante)))
      })
    return () => {
      vigente = false
    }
  }, [])

  // Nueva: urgencia media y el último solicitante usado en este navegador.
  const [valoresIniciales] = useState(
    () =>
      registro ?? {
        id_insumo_okima: '',
        cantidad_solicitada: '',
        nivel_urgencia: URGENCIA_POR_DEFECTO,
        fecha_esperada: '',
        solicitante: leerUltimoSolicitante(),
      },
  )

  const campos = useMemo(
    () => [
      {
        clave: 'id_insumo_okima',
        etiqueta: 'Insumo',
        tipo: 'personalizado',
        requerido: true,
        ayuda: 'Si no existe, escríbelo y elige "Crear": pide solo nombre y subcategoría.',
        render: ({ id, valor, onChange }) => (
          <SelectorInsumo
            id={id}
            valor={valor}
            onChange={onChange}
            insumos={insumos}
            onCrearInsumo={crearInsumo}
            cargando={cargando}
          />
        ),
      },
      {
        clave: 'cantidad_solicitada',
        etiqueta: 'Cantidad',
        tipo: 'numero',
        requerido: true,
        validar: (valor) => (valor > 0 ? null : 'Debe ser mayor que 0.'),
      },
      {
        clave: 'nivel_urgencia',
        etiqueta: 'Urgencia',
        tipo: 'personalizado',
        requerido: true,
        render: ({ id, valor, onChange }) => <SelectorUrgencia id={id} valor={valor} onChange={onChange} />,
      },
      {
        clave: 'fecha_esperada',
        etiqueta: 'Fecha tope',
        tipo: 'fecha',
        ayuda: 'Opcional: para cuándo se necesita.',
      },
      {
        clave: 'solicitante',
        etiqueta: 'Solicitante',
        tipo: 'texto',
        requerido: true,
        sugerencias: solicitantes,
      },
    ],
    [insumos, crearInsumo, cargando, solicitantes],
  )

  const guardar = async (datos) => {
    await onGuardar(datos)
    guardarUltimoSolicitante(datos.solicitante)
  }

  return (
    <>
      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          No se pudieron cargar los insumos: {mensajeError(error)}
        </p>
      )}
      <FormularioRegistro
        campos={campos}
        valoresIniciales={valoresIniciales}
        onGuardar={guardar}
        onCancelar={onCancelar}
        textoGuardar={registro ? 'Guardar cambios' : 'Crear solicitud'}
      />
    </>
  )
}

// Botones segmentados Baja / Media / Alta, con el color de cada nivel.
function SelectorUrgencia({ id, valor, onChange }) {
  return (
    <div id={id} role="radiogroup" aria-label="Urgencia" className="grid grid-cols-3 gap-2">
      {NIVELES_URGENCIA.map((nivel) => {
        const { etiqueta, simbolo, claseBoton } = metaUrgencia(nivel)
        const activo = valor === nivel
        return (
          <button
            key={nivel}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(nivel)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              activo ? `${claseBoton} ring-2 ring-current/30` : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden="true">{simbolo}</span>
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export default FormularioSolicitud
