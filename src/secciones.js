import { ChartColumn, ClipboardList, FolderTree, Package, Receipt, Truck, Wallet } from 'lucide-react'

// Las 6 secciones de Funcionalidades Core (CLAUDE.md) más el Resumen de Gastos,
// en el orden del menú.
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
  // Solo lectura: junta facturas y otros gastos (ver lib/resumen.js).
  {
    path: '/resumen',
    titulo: 'Resumen de Gastos',
    descripcion: 'Gasto mensual de facturas y otros gastos, por centro de costo.',
    icono: ChartColumn,
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
    descripcion: 'Insumos internos de Okima: subcategoría, venta directa y stock.',
    icono: Package,
  },
  // Sección propia (no dentro de Insumos): la usan también Otros Gastos y las plantillas.
  {
    path: '/centros-costo',
    titulo: 'Centros de Costo',
    descripcion: 'Categorías (centros de costo) y sus subcategorías, usadas por insumos, gastos y plantillas.',
    icono: FolderTree,
  },
]
