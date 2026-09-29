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

// Solo `codigo` queda vacío por la creación al vuelo (el RUT es obligatorio).
const esIncompleto = (fila) => estaVacio(fila.codigo)

// Se busca por el RUT tal como está escrito y también normalizado (sin puntos ni guion).
const camposBusqueda = ['nombre', 'codigo', 'rut', (fila) => normalizarRut(fila.rut)]

// Crear y editar abren el formulario en su propia página (/proveedores/nuevo,
// /proveedores/:id, ver FormularioProveedor), no en un modal.
function Proveedores() {
  return (
    <Mantenedor
      titulo="Proveedores"
      descripcion="Datos de contacto y de pago de cada proveedor."
      tabla="proveedores"
      columnas={columnas}
      esIncompleto={esIncompleto}
      camposBusqueda={camposBusqueda}
      nombreArchivo="proveedores"
      rutaFormulario="/proveedores"
    />
  )
}

export default Proveedores
