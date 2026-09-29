import PaginaRegistro from '../../components/PaginaRegistro'
import { normalizarRut } from '../../lib/texto'

// En 2 columnas quedan de a pares: Nombre | RUT, Código solo, Dirección | Dirección 2,
// Email | Email 2, Teléfono | Teléfono 2; las áreas de texto ocupan todo el ancho.
const campos = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'rut', etiqueta: 'RUT', tipo: 'rut', requerido: true, ayuda: 'Ej. 76.123.456-7' },
  { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ayuda: 'Ej. ID + nombre abreviado', completo: true },
  { clave: 'direccion_1', etiqueta: 'Dirección', tipo: 'texto' },
  { clave: 'direccion_2', etiqueta: 'Dirección 2', tipo: 'texto' },
  { clave: 'email_1', etiqueta: 'Email', tipo: 'texto' },
  { clave: 'email_2', etiqueta: 'Email 2', tipo: 'texto' },
  { clave: 'fono_1', etiqueta: 'Teléfono', tipo: 'texto' },
  { clave: 'fono_2', etiqueta: 'Teléfono 2', tipo: 'texto' },
  { clave: 'datos_transferencia', etiqueta: 'Datos de transferencia', tipo: 'area' },
  { clave: 'notas', etiqueta: 'Notas', tipo: 'area' },
]

const valoresIniciales = Object.fromEntries(campos.map((c) => [c.clave, '']))

// Además del nombre parecido, avisa si otro proveedor tiene el mismo RUT escrito
// distinto (puntos, guion, k minúscula). Al editar, solo si el RUT cambió.
const mismoRut = (valores, candidatos, registro) => {
  const rut = normalizarRut(valores.rut)
  if (!rut || (registro && normalizarRut(registro.rut) === rut)) return []
  return candidatos.filter((c) => normalizarRut(c.rut) === rut)
}

const etiquetaDuplicado = (r) => `${r.nombre} (RUT ${r.rut})`

// /proveedores/nuevo y /proveedores/:id: el formulario en página propia (no modal),
// con el listado de Proveedores como vuelta.
function FormularioProveedor() {
  return (
    <PaginaRegistro
      titulo="proveedor"
      tabla="proveedores"
      campos={campos}
      valoresIniciales={valoresIniciales}
      rutaListado="/proveedores"
      duplicadosAdicionales={mismoRut}
      etiquetaDuplicado={etiquetaDuplicado}
    />
  )
}

export default FormularioProveedor
