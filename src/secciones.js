import { ClipboardList, Package, Receipt, Truck, Wallet } from 'lucide-react'

// Las 5 secciones de Funcionalidades Core (CLAUDE.md), en el orden del menú.
// Las usan tanto el menú lateral como el enrutador.
export const secciones = [
  {
    path: '/solicitudes',
    titulo: 'Solicitudes de Compra',
    descripcion: 'Pedidos de insumos pendientes, por urgencia, e impresión de la lista.',
    icono: ClipboardList,
  },
  {
    path: '/facturas',
    titulo: 'Facturas',
    descripcion: 'Ingreso de facturas de proveedores con sus líneas de detalle.',
    icono: Receipt,
  },
  {
    path: '/gastos',
    titulo: 'Otros Gastos',
    descripcion: 'Gastos sin stock (arriendo, sueldos, IVA) y sus plantillas recurrentes.',
    icono: Wallet,
  },
  {
    path: '/proveedores',
    titulo: 'Proveedores',
    descripcion: 'Proveedores, su catálogo de insumos y los insumos por vincular.',
    icono: Truck,
  },
  {
    path: '/insumos',
    titulo: 'Insumos Okima',
    descripcion: 'Insumos internos, categorías (centros de costo) y subcategorías.',
    icono: Package,
  },
]
