import Mantenedor from '../../components/Mantenedor'
import { estaVacio, normalizarRut } from '../../lib/texto'

// En pantalla solo los datos de contacto principales; el resto va al CSV.
const columnas = [
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'rut', titulo: 'RUT', render: (fila) => <span className="whitespace-nowrap">{fila.rut}</span> },
  { clave: 'codigo', titulo: 'Código' },
  { clave: 'email_1', titulo: 'Email' },
  { clave: 'fono_1', titulo: 'Teléfono', render: (fila) => <span className="whitespace-nowrap">{fila.fono_1}</span> },
  { clave: 'email_2', titulo: 'Email 2', soloCsv: true },
  { clave: 'fono_2', titulo: 'Teléfono 2', soloCsv: true },
  { clave: 'direccion_1', titulo: 'Dirección', soloCsv: true },
  { clave: 'direccion_2', titulo: 'Dirección 2', soloCsv: true },
  { clave: 'datos_transferencia', titulo: 'Datos de transferencia', soloCsv: true },
  { clave: 'notas', titulo: 'Notas', soloCsv: true },
]

const campos = [
  { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
  { clave: 'rut', etiqueta: 'RUT', tipo: 'texto', requerido: true, ayuda: 'Ej. 76.123.456-7' },
  { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', ayuda: 'Ej. ID + nombre abreviado' },
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

// Solo `codigo` queda vacío por la creación al vuelo (el RUT es obligatorio).
const esIncompleto = (fila) => estaVacio(fila.codigo)

// Se busca por el RUT tal como está escrito y también normalizado (sin puntos ni guion).
const camposBusqueda = ['nombre', 'codigo', 'rut', (fila) => normalizarRut(fila.rut)]

// Además del nombre parecido, avisa si otro proveedor tiene el mismo RUT escrito
// distinto (puntos, guion, k minúscula). Al editar, solo si el RUT cambió.
const mismoRut = (valores, candidatos, registro) => {
  const rut = normalizarRut(valores.rut)
  if (!rut || (registro && normalizarRut(registro.rut) === rut)) return []
  return candidatos.filter((c) => normalizarRut(c.rut) === rut)
}

const etiquetaDuplicado = (r) => `${r.nombre} (RUT ${r.rut})`

function Proveedores() {
  return (
    <Mantenedor
      titulo="Proveedores"
      descripcion="Datos de contacto y de pago de cada proveedor."
      tabla="proveedores"
      columnas={columnas}
      campos={campos}
      valoresIniciales={valoresIniciales}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="proveedores"
      duplicadosAdicionales={mismoRut}
      etiquetaDuplicado={etiquetaDuplicado}
    />
  )
}

export default Proveedores
