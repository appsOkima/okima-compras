-- Verificación posterior a 2026-10-02-08-detalle-boletas.sql.
-- SOLO LECTURA: no modifica nada. Ejecutar en el SQL Editor y revisar cada bloque.
-- AJUSTADO A LA MIGRACION 13 (boletas sin concepto ni insumos del proveedor): este archivo corre
-- contra la base FINAL. La 13 eliminó movimientos_stock.id_detalle_boleta, su CHECK
-- (movimientos_stock_origen_check), su índice único, los triggers/función de stock de boletas y
-- boletas.concepto. Por eso los bloques 1, 4, 5, 6 y 7 se adaptaron (ver el comentario de cada uno).
-- Los chequeos propios de la base ANTES de la 13 (mov_boleta, origen único, triggers de stock
-- de boletas) ya no existen; para auditar ese estado histórico, ejecutar este archivo antes de la 13.

-- 1. Estructura: debe devolver detalle_boletas (1 fila) y la columna id_detalle_factura de movimientos_stock
--    con is_nullable = NO (tras la 13; id_detalle_boleta ya no existe). Antes de la 13 eran dos columnas, ambas YES.
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'detalle_boletas';

select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'movimientos_stock'
  and column_name in ('id_detalle_factura', 'id_detalle_boleta')  -- id_detalle_boleta: 0 filas tras la 13
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
--    (boletas.concepto ya no existe tras la 13: se identifica la boleta por id.)
select b.id, b.monto, sum(d.subtotal) as suma_lineas, count(d.id) as lineas
from boletas b
join detalle_boletas d on d.id_boleta = b.id
group by b.id, b.monto
having b.monto <> sum(d.subtotal)
order by b.fecha desc;

-- 4. Sin huérfanos ni líneas inválidas: las tres cifras deben ser 0. Tras la 13, "origen único" es
--    movimientos sin id_detalle_factura (la columna es NOT NULL, por lo que debe ser 0).
select
  (select count(*) from detalle_boletas d left join boletas b on b.id = d.id_boleta
     where b.id is null)                                                          as lineas_huerfanas,
  (select count(*) from detalle_boletas where cantidad <= 0)                      as cantidades_invalidas,
  (select count(*) from movimientos_stock where id_detalle_factura is null)
                                                                                  as movimientos_sin_origen_unico;

-- 5. Movimientos (tras la 13 todos son de factura; ya no hay columna mov_boleta).
select
  (select count(*) from movimientos_stock where id_detalle_factura is not null) as mov_factura,
  (select coalesce(sum(qty), 0) from insumos)                                    as suma_stock_insumos;

-- 6. Constraint e índices. Tras la 13: movimientos_stock_origen_check NO debe existir (0 filas) y el índice
--    movimientos_stock_detalle_boleta_insumo_key tampoco; solo queda el índice único de factura.
select conname, pg_get_constraintdef(oid) as definicion from pg_constraint
where conrelid = 'public.movimientos_stock'::regclass and conname = 'movimientos_stock_origen_check';

select indexname from pg_indexes
where schemaname = 'public'
  and tablename in ('movimientos_stock', 'detalle_boletas')
order by 1;

-- 7. Triggers esperados tras la 13: movimientos_stock_aplicar y los de detalle_facturas, más
--    detalle_boletas_bloquear_si_anulada y los de exclusividad/'Comprada' en detalle_boletas. Ya NO deben
--    existir detalle_boletas_generar_stock_ins ni detalle_boletas_generar_stock_upd (eliminados por la 13).
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
