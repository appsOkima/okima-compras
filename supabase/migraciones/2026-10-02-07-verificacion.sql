-- Verificación posterior a 2026-10-02-07-insumos-proveedores-okima.sql.
-- SOLO LECTURA: no modifica nada. Ejecutar en el SQL Editor y revisar cada bloque.
-- Los totales "antes" salen de lo que se anotó/respaldó ANTES de migrar (las columnas
-- originales ya no existen); reemplazar los valores de la sección 2 por esos números.

-- 1. Estructura: debe devolver 2 filas (las tablas nuevas) y 0 filas en la segunda consulta
--    (columnas viejas eliminadas).
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('insumos_proveedores_okima', 'movimientos_stock')
order by 1;

select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'insumos_proveedores' and column_name = 'id_insumo_okima')
    or (table_name = 'detalle_facturas' and column_name in ('id_insumo_stock', 'qty_stock')));

-- 2. Conteos y sumas ahora, para compararlos con los de antes de migrar:
--    antes: count(*) from insumos_proveedores where id_insumo_okima is not null
--           select count(*), sum(qty_stock) from detalle_facturas where id_insumo_stock is not null
select
  (select count(*) from insumos_proveedores_okima)      as vinculos_pivote,
  (select count(*) from movimientos_stock)               as movimientos,
  (select coalesce(sum(qty), 0) from movimientos_stock)  as suma_movimientos,
  (select coalesce(sum(qty), 0) from insumos)            as suma_stock_insumos;

-- 3. Sin vínculos huérfanos ni inválidos: las tres cifras deben ser 0.
select
  (select count(*) from insumos_proveedores_okima po
     left join insumos_proveedores ip on ip.id = po.id_insumo_proveedor
     left join insumos i on i.id = po.id_insumo_okima
   where ip.id is null or i.id is null)                        as vinculos_huerfanos,
  (select count(*) from insumos_proveedores_okima where factor_conversion <= 0) as factores_invalidos,
  (select count(*) from movimientos_stock m
     left join detalle_facturas d on d.id = m.id_detalle_factura
     left join insumos i on i.id = m.id_insumo
   where d.id is null or i.id is null)                         as movimientos_huerfanos;

-- 4. Cada insumo_proveedor migrado con su factor (revisar los que tienen cantidad_formato
--    vacío o 0: quedaron con factor 1).
select ip.nombre as insumo_proveedor, p.nombre as proveedor, i.nombre as insumo_okima,
       po.factor_conversion, ip.cantidad_formato, ip.formato_unidad
from insumos_proveedores_okima po
join insumos_proveedores ip on ip.id = po.id_insumo_proveedor
join proveedores p on p.id = ip.id_proveedor
join insumos i on i.id = po.id_insumo_okima
order by p.nombre, ip.nombre, i.nombre;

-- 5. Coherencia de stock por insumo: movimientos de facturas vs insumos.qty.
--    Ojo: insumos.qty puede incluir ajustes manuales o stock inicial que no vienen de
--    facturas, así que una diferencia es informativa; lo que NO debe pasar es que
--    cambie respecto del valor que tenía antes de migrar (la migración no toca insumos.qty).
select i.nombre, i.qty as qty_actual, coalesce(m.s, 0) as suma_movimientos, i.qty - coalesce(m.s, 0) as diferencia
from insumos i
left join (select id_insumo, sum(qty) as s from movimientos_stock group by id_insumo) m on m.id_insumo = i.id
where m.s is not null
order by i.nombre;

-- 6. Triggers esperados: movimientos_stock_aplicar, detalle_facturas_generar_stock_ins y
--    detalle_facturas_generar_stock_upd; NO deben existir calcular_stock / aplicar_stock.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('detalle_facturas', 'movimientos_stock')
group by 1, 2
order by 1, 2;

-- 7. La vista conserva sus 14 columnas, en este orden.
select ordinal_position, column_name from information_schema.columns
where table_schema = 'public' and table_name = 'vista_solicitudes_pendientes'
order by ordinal_position;

-- 8. RLS activo con la política acceso_publico en las tablas nuevas (2 filas).
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename in ('insumos_proveedores_okima', 'movimientos_stock');
