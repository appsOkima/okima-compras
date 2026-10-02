-- =============================================================================
-- Okima Compras — borrar todos los datos (salvo categorías y subcategorías)
--
-- ⚠ IRREVERSIBLE. Pensado para limpiar datos de prueba: ejecutar en el SQL
-- Editor de Supabase cuando se quiera dejar la base en blanco.
--
-- Borra: movimientos_stock, insumos_proveedores_okima, detalle_facturas, facturas, solicitudes_compra, insumos_proveedores,
-- insumos, boletas, plantillas_gastos_recurrentes y proveedores.
-- Conserva: categorias y subcategorias (centros de costo).
--
-- Sin CASCADE a propósito: si en el futuro otra tabla referencia a alguna de
-- estas, el script falla en vez de borrarla sin que se note.
-- =============================================================================

begin;

truncate table
  movimientos_stock,
  insumos_proveedores_okima,
  detalle_facturas,
  facturas,
  solicitudes_compra,
  insumos_proveedores,
  insumos,
  boletas,
  plantillas_gastos_recurrentes,
  proveedores;

-- Opcional: volver a crear las plantillas de gasto recurrente iniciales
-- (Arriendo, Sueldos, Pago IVA con monto 0). Descomentar si se quieren.
-- insert into plantillas_gastos_recurrentes (nombre, id_subcategoria, monto_default)
-- select v.nombre, s.id, 0
-- from (values
--   ('Arriendo', 'Infraestructura'),
--   ('Sueldos',  'Remuneraciones'),
--   ('Pago IVA', 'Impuestos y Finanzas')
-- ) as v (nombre, subcategoria)
-- join subcategorias s on s.nombre = v.subcategoria
-- join categorias c on c.id = s.id_categoria and c.nombre = 'GASTOS ADMINISTRATIVOS Y FIJOS';

commit;

-- Resultado: filas que quedan en cada tabla.
select 'categorias' as tabla, count(*) as filas from categorias
union all select 'subcategorias', count(*) from subcategorias
union all select 'proveedores', count(*) from proveedores
union all select 'insumos', count(*) from insumos
union all select 'insumos_proveedores', count(*) from insumos_proveedores
union all select 'solicitudes_compra', count(*) from solicitudes_compra
union all select 'facturas', count(*) from facturas
union all select 'insumos_proveedores_okima', count(*) from insumos_proveedores_okima
union all select 'detalle_facturas', count(*) from detalle_facturas
union all select 'movimientos_stock', count(*) from movimientos_stock
union all select 'boletas', count(*) from boletas
union all select 'plantillas_gastos_recurrentes', count(*) from plantillas_gastos_recurrentes;
