-- Verificación posterior a 2026-10-02-13-boletas-sin-concepto-ni-insumos.sql.
-- SOLO LECTURA: no modifica nada.
-- ⚠ EJECUTAR COMPLETO, NO DIVIDIR POR BLOQUES: es un único SELECT (el SQL Editor solo muestra
--   el último resultado). Devuelve UNA fila: cada columna es un chequeo (true = bien) y `ok`
--   es true solo si todos los booleanos son true. `boletas_sin_lineas` y
--   `movimientos_stock_total` son informativos (los booleanos no los usan, salvo
--   `todas_boletas_con_lineas`).

with c as (
  select
    -- columnas eliminadas
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'boletas' and column_name = 'concepto')
      as boletas_sin_concepto,
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'detalle_boletas' and column_name = 'id_insumo_proveedor')
      as detalle_boletas_sin_insumo_proveedor,
    not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'movimientos_stock' and column_name = 'id_detalle_boleta')
      as movimientos_sin_id_detalle_boleta,

    -- índices, CHECK y función eliminados
    not exists (select 1 from pg_indexes where schemaname = 'public'
      and indexname in ('detalle_boletas_id_insumo_proveedor_idx', 'movimientos_stock_detalle_boleta_insumo_key'))
      as indices_eliminados,
    not exists (select 1 from pg_constraint k
      join pg_class t on t.oid = k.conrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and k.conname = 'movimientos_stock_origen_check')
      as check_origen_eliminado,
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'generar_movimientos_stock_boleta')
      as funcion_stock_boleta_eliminada,

    -- triggers de stock de boletas eliminados
    not exists (select 1 from pg_trigger g
      where not g.tgisinternal
        and g.tgname in ('detalle_boletas_generar_stock_ins', 'detalle_boletas_generar_stock_upd',
                         'boletas_sincronizar_stock_estado'))
      as triggers_stock_boleta_eliminados,

    -- id_detalle_factura NOT NULL
    exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'movimientos_stock'
        and column_name = 'id_detalle_factura' and is_nullable = 'NO')
      as id_detalle_factura_not_null,

    -- sincronizar_stock_estado_documento existe, solo de facturas (SECURITY DEFINER, sin referencias a boletas)
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'sincronizar_stock_estado_documento'
        and p.prosecdef
        and p.prosrc not ilike '%detalle_boletas%' and p.prosrc not ilike '%id_detalle_boleta%')
      as sincronizar_solo_facturas,
    exists (select 1 from pg_trigger g join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and t.relname = 'facturas' and g.tgname = 'facturas_sincronizar_stock_estado')
      as trigger_facturas_sincronizar_ok,

    -- se mantienen: validación de estado y bloqueo de líneas de documento anulado
    (select count(*) = 4 from pg_trigger g join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and g.tgname in ('facturas_validar_estado', 'boletas_validar_estado',
                         'detalle_facturas_bloquear_si_anulada', 'detalle_boletas_bloquear_si_anulada'))
      as triggers_estado_bloqueo_ok,

    -- se mantienen: vínculo con solicitud en las líneas de boleta
    exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'detalle_boletas'
        and column_name = 'id_solicitud_compra')
      as columna_solicitud_ok,
    (select count(*) = 2 from pg_trigger g join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and t.relname = 'detalle_boletas'
        and g.tgname in ('detalle_boletas_marcar_solicitud_comprada',
                         'detalle_boletas_validar_exclusividad_solicitud'))
      as triggers_solicitud_boletas_ok,

    -- se mantienen: columnas de boletas
    (select count(*) = 5 from information_schema.columns
      where table_schema = 'public' and table_name = 'boletas'
        and column_name in ('id_subcategoria', 'id_proveedor', 'numero_documento', 'monto', 'notas'))
      as columnas_boletas_ok,

    -- RLS sin cambios (4 políticas por tabla) y trigger de stock de movimientos vivo
    (select count(*) = 4 from pg_policies where schemaname = 'public' and tablename = 'detalle_boletas')
      as politicas_detalle_boletas_ok,
    (select count(*) = 4 from pg_policies where schemaname = 'public' and tablename = 'movimientos_stock')
      as politicas_movimientos_ok,
    exists (select 1 from pg_trigger g join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and t.relname = 'movimientos_stock' and g.tgname = 'movimientos_stock_aplicar')
      as trigger_movimientos_aplicar_ok,

    -- toda boleta conserva al menos una línea con descripcion (su nombre)
    not exists (select 1 from public.boletas b
      where not exists (select 1 from public.detalle_boletas d
        where d.id_boleta = b.id and btrim(d.descripcion) <> ''))
      as todas_boletas_con_lineas,

    -- informativos
    (select count(*) from public.boletas b
      where not exists (select 1 from public.detalle_boletas d where d.id_boleta = b.id))
      as boletas_sin_lineas,
    (select count(*) from public.movimientos_stock) as movimientos_stock_total
)
select
  c.*,
  (c.boletas_sin_concepto
   and c.detalle_boletas_sin_insumo_proveedor
   and c.movimientos_sin_id_detalle_boleta
   and c.indices_eliminados
   and c.check_origen_eliminado
   and c.funcion_stock_boleta_eliminada
   and c.triggers_stock_boleta_eliminados
   and c.id_detalle_factura_not_null
   and c.sincronizar_solo_facturas
   and c.trigger_facturas_sincronizar_ok
   and c.triggers_estado_bloqueo_ok
   and c.columna_solicitud_ok
   and c.triggers_solicitud_boletas_ok
   and c.columnas_boletas_ok
   and c.politicas_detalle_boletas_ok
   and c.politicas_movimientos_ok
   and c.trigger_movimientos_aplicar_ok
   and c.todas_boletas_con_lineas) as ok
from c;
