-- Verificación posterior a 2026-10-02-08-detalle-boletas.sql.
-- SOLO LECTURA: no modifica nada. Ejecutar en el SQL Editor y revisar cada bloque.

-- 1. Estructura: debe devolver detalle_boletas (1 fila) y las dos columnas de origen de movimientos_stock;
--    id_detalle_factura debe aparecer con is_nullable = YES.
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'detalle_boletas';

select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'movimientos_stock'
  and column_name in ('id_detalle_factura', 'id_detalle_boleta')
order by column_name;

-- 2. Ninguna boleta sin líneas (debe ser 0) y conteos.
select
  (select count(*) from boletas b
     where not exists (select 1 from detalle_boletas d where d.id_boleta = b.id)) as boletas_sin_lineas,
  (select count(*) from boletas)                                                  as boletas,
  (select count(*) from detalle_boletas)                                          as lineas;

-- 3. monto vs suma de subtotales por boleta: debe devolver 0 filas para las boletas migradas
--    (una línea). Las boletas editadas después desde la interfaz también deberían cuadrar;
--    si aparece alguna, revisar si el total quedó desactualizado.
select b.id, b.concepto, b.monto, sum(d.subtotal) as suma_lineas, count(d.id) as lineas
from boletas b
join detalle_boletas d on d.id_boleta = b.id
group by b.id, b.concepto, b.monto
having b.monto <> sum(d.subtotal)
order by b.fecha desc;

-- 4. Sin huérfanos ni líneas inválidas: las tres cifras deben ser 0.
select
  (select count(*) from detalle_boletas d left join boletas b on b.id = d.id_boleta
     where b.id is null)                                                          as lineas_huerfanas,
  (select count(*) from detalle_boletas where cantidad <= 0)                      as cantidades_invalidas,
  (select count(*) from movimientos_stock where num_nonnulls(id_detalle_factura, id_detalle_boleta) <> 1)
                                                                                  as movimientos_sin_origen_unico;

-- 5. Movimientos por origen (los de factura no deben haber cambiado respecto del antes de migrar).
select
  (select count(*) from movimientos_stock where id_detalle_factura is not null) as mov_factura,
  (select count(*) from movimientos_stock where id_detalle_boleta is not null)  as mov_boleta,
  (select coalesce(sum(qty), 0) from insumos)                                    as suma_stock_insumos;

-- 6. Constraint e índices: movimientos_stock_origen_check; índices únicos de factura y boleta.
select conname, pg_get_constraintdef(oid) as definicion from pg_constraint
where conrelid = 'public.movimientos_stock'::regclass and conname = 'movimientos_stock_origen_check';

select indexname from pg_indexes
where schemaname = 'public'
  and tablename in ('movimientos_stock', 'detalle_boletas')
order by 1;

-- 7. Triggers esperados: detalle_boletas_generar_stock_ins y detalle_boletas_generar_stock_upd,
--    además de movimientos_stock_aplicar y los de detalle_facturas.
select event_object_table as tabla, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('detalle_boletas', 'detalle_facturas', 'movimientos_stock')
group by 1, 2
order by 1, 2;

-- 8. RLS activo con la política acceso_publico (1 fila).
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename = 'detalle_boletas';

-- 9. vista_solicitudes_pendientes NO se toca: sigue con sus 14 columnas.
select count(*) as columnas_vista from information_schema.columns
where table_schema = 'public' and table_name = 'vista_solicitudes_pendientes';
