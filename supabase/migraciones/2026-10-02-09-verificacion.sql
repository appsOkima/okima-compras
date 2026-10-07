-- Verificación posterior a 2026-10-02-09-estado-anulado.sql.
-- SOLO LECTURA: no modifica nada. Ejecutar en el SQL Editor y revisar cada bloque.

-- 1. Enum: debe devolver vigente, anulado (en ese orden).
select enumlabel from pg_enum
where enumtypid = 'public.estado_documento'::regtype
order by enumsortorder;

-- 2. Columnas: 4 por tabla (estado_documento not null default 'vigente'; las otras nullable) + revertido.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and ((table_name in ('facturas', 'boletas')
        and column_name in ('estado_documento', 'anulado_por', 'anulado_at', 'motivo_anulacion'))
    or (table_name = 'movimientos_stock' and column_name = 'revertido'))
order by table_name, column_name;

-- 3. Conteos por estado. Recién migrado: todo 'vigente' y 0 revertidos.
select 'facturas' as tabla, estado_documento::text as estado, count(*) from facturas group by 2
union all
select 'boletas', estado_documento::text, count(*) from boletas group by 2
order by 1, 2;

select revertido, count(*) as movimientos, coalesce(sum(qty), 0) as qty_total
from movimientos_stock group by revertido order by revertido;

-- 4. Coherencia stock/estado (las cuatro cifras deben ser 0):
--    movimientos revertidos de documentos vigentes, movimientos NO revertidos de documentos
--    anulados, y datos de anulación inconsistentes.
select
  (select count(*) from movimientos_stock m
     join detalle_facturas d on d.id = m.id_detalle_factura
     join facturas f on f.id = d.id_factura
     where m.revertido and f.estado_documento = 'vigente')
  + (select count(*) from movimientos_stock m
     join detalle_boletas d on d.id = m.id_detalle_boleta
     join boletas b on b.id = d.id_boleta
     where m.revertido and b.estado_documento = 'vigente')            as revertidos_en_documentos_vigentes,
  (select count(*) from movimientos_stock m
     join detalle_facturas d on d.id = m.id_detalle_factura
     join facturas f on f.id = d.id_factura
     where not m.revertido and f.estado_documento = 'anulado')
  + (select count(*) from movimientos_stock m
     join detalle_boletas d on d.id = m.id_detalle_boleta
     join boletas b on b.id = d.id_boleta
     where not m.revertido and b.estado_documento = 'anulado')        as no_revertidos_en_documentos_anulados,
  (select count(*) from facturas where estado_documento = 'anulado' and anulado_at is null)
  + (select count(*) from boletas where estado_documento = 'anulado' and anulado_at is null)
                                                                        as anulados_sin_fecha,
  (select count(*) from facturas
     where estado_documento = 'vigente'
       and (anulado_at is not null or anulado_por is not null or motivo_anulacion is not null))
  + (select count(*) from boletas
     where estado_documento = 'vigente'
       and (anulado_at is not null or anulado_por is not null or motivo_anulacion is not null))
                                                                        as vigentes_con_datos_de_anulacion;

-- 5. Triggers esperados (cada uno una vez):
--    facturas: facturas_validar_estado, facturas_sincronizar_stock_estado
--    boletas:  boletas_validar_estado, boletas_sincronizar_stock_estado
--    detalle_facturas / detalle_boletas: ..._bloquear_si_anulada (además de los de stock)
--    movimientos_stock: movimientos_stock_aplicar (debe incluir "UPDATE OF ... revertido").
select event_object_table as tabla, trigger_name, action_timing, string_agg(event_manipulation, ', ') as eventos
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('facturas', 'boletas', 'detalle_facturas', 'detalle_boletas', 'movimientos_stock')
group by 1, 2, 3
order by 1, 2;

select tgname, pg_get_triggerdef(oid) as definicion
from pg_trigger
where tgrelid = 'public.movimientos_stock'::regclass and not tgisinternal;

-- 6. Funciones: SECURITY DEFINER (prosecdef = true) y search_path fijo (proconfig) en las cuatro.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('aplicar_movimiento_stock', 'validar_estado_documento',
                  'sincronizar_stock_estado_documento', 'bloquear_lineas_documento_anulado')
order by proname;

-- 7. Índices parciales de anulados (2 filas).
select indexname, indexdef from pg_indexes
where schemaname = 'public' and indexname in ('facturas_anuladas_idx', 'boletas_anuladas_idx');

-- 8. UNIQUE (id_proveedor, numero_factura) sigue intacto (una factura anulada conserva su número).
select conname, pg_get_constraintdef(oid) as definicion from pg_constraint
where conrelid = 'public.facturas'::regclass and conname = 'facturas_proveedor_numero_key';

-- 9. Documentos anulados actuales (informativo; vacío justo tras migrar).
select 'factura' as tipo, id, anulado_at, anulado_por, motivo_anulacion from facturas where estado_documento = 'anulado'
union all
select 'boleta', id, anulado_at, anulado_por, motivo_anulacion from boletas where estado_documento = 'anulado'
order by anulado_at desc;
