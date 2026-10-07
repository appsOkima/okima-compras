-- Verificación posterior a 2026-10-02-12-vinculo-solicitud-boletas.sql.
-- SOLO LECTURA: no modifica nada.
-- ⚠ EJECUTAR COMPLETO, NO DIVIDIR POR BLOQUES: es un único SELECT (el SQL Editor solo muestra
--   el último resultado). Devuelve UNA fila: cada columna es un chequeo (true = bien) y `ok`
--   es true solo si todos son true. Las columnas `lineas_boleta_con_solicitud` y
--   `solicitudes_en_ambas` son informativas/consistencia (la segunda debe ser 0).

select
  -- columna: uuid, nullable
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'detalle_boletas'
      and column_name = 'id_solicitud_compra' and udt_name = 'uuid' and is_nullable = 'YES'
  ) as columna_ok,

  -- FK hacia solicitudes_compra con on delete set null (confdeltype = 'n')
  exists (
    select 1
    from pg_constraint k
    join pg_class t on t.oid = k.conrelid
    join pg_namespace tn on tn.oid = t.relnamespace
    join pg_class r on r.oid = k.confrelid
    join pg_namespace rn on rn.oid = r.relnamespace
    where k.contype = 'f' and k.confdeltype = 'n'
      and tn.nspname = 'public' and t.relname = 'detalle_boletas'
      and rn.nspname = 'public' and r.relname = 'solicitudes_compra'
      and k.conkey = array[(
        select a.attnum from pg_attribute a where a.attrelid = t.oid and a.attname = 'id_solicitud_compra'
      )]
  ) as fk_set_null_ok,

  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'detalle_boletas'
      and indexname = 'detalle_boletas_id_solicitud_compra_idx'
  ) as indice_ok,

  -- los 3 triggers nuevos existen y están habilitados (tgenabled = 'O')
  (
    select count(*) = 3
    from pg_trigger g
    join pg_class t on t.oid = g.tgrelid
    join pg_namespace n on n.oid = t.relnamespace
    where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
      and ((t.relname = 'detalle_boletas'  and g.tgname in ('detalle_boletas_marcar_solicitud_comprada',
                                                            'detalle_boletas_validar_exclusividad_solicitud'))
        or (t.relname = 'detalle_facturas' and g.tgname = 'detalle_facturas_validar_exclusividad_solicitud'))
  ) as triggers_ok,

  -- el trigger 'Comprada' de facturas sigue (T anterior)
  exists (
    select 1
    from pg_trigger g
    join pg_class t on t.oid = g.tgrelid
    join pg_namespace n on n.oid = t.relnamespace
    where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
      and t.relname = 'detalle_facturas' and g.tgname = 'detalle_facturas_marcar_solicitud_comprada'
  ) as trigger_comprada_facturas_ok,

  -- validar_exclusividad_solicitud: SECURITY DEFINER con search_path = public
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'validar_exclusividad_solicitud'
      and p.prosecdef
      and array_to_string(p.proconfig, ',') like '%search_path=public%'
  ) as funcion_exclusividad_ok,

  -- marcar_solicitud_comprada() sigue existiendo (compartida por ambas tablas)
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'marcar_solicitud_comprada'
  ) as funcion_comprada_ok,

  -- compatibilidad: los triggers de bloqueo por documento anulado siguen en ambas tablas de líneas
  (
    select count(*) = 2
    from pg_trigger g
    join pg_class t on t.oid = g.tgrelid
    join pg_namespace n on n.oid = t.relnamespace
    where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
      and g.tgname in ('detalle_facturas_bloquear_si_anulada', 'detalle_boletas_bloquear_si_anulada')
  ) as triggers_bloqueo_anulado_ok,

  -- las 4 políticas RLS de detalle_boletas siguen (sin cambios)
  (
    select count(*) = 4 from pg_policies
    where schemaname = 'public' and tablename = 'detalle_boletas'
  ) as politicas_detalle_boletas_ok,

  -- consistencia: ninguna solicitud con líneas de factura Y de boleta (debe ser 0)
  (
    select count(*) from (
      select id_solicitud_compra from public.detalle_facturas where id_solicitud_compra is not null
      intersect
      select id_solicitud_compra from public.detalle_boletas where id_solicitud_compra is not null
    ) x
  ) as solicitudes_en_ambas,

  -- informativo: líneas de boleta ya vinculadas (0 recién migrado)
  (select count(*) from public.detalle_boletas where id_solicitud_compra is not null)
    as lineas_boleta_con_solicitud,

  -- ok global
  (
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'detalle_boletas'
        and column_name = 'id_solicitud_compra' and udt_name = 'uuid' and is_nullable = 'YES'
    )
    and exists (
      select 1
      from pg_constraint k
      join pg_class t on t.oid = k.conrelid
      join pg_namespace tn on tn.oid = t.relnamespace
      join pg_class r on r.oid = k.confrelid
      join pg_namespace rn on rn.oid = r.relnamespace
      where k.contype = 'f' and k.confdeltype = 'n'
        and tn.nspname = 'public' and t.relname = 'detalle_boletas'
        and rn.nspname = 'public' and r.relname = 'solicitudes_compra'
        and k.conkey = array[(
          select a.attnum from pg_attribute a where a.attrelid = t.oid and a.attname = 'id_solicitud_compra'
        )]
    )
    and exists (
      select 1 from pg_indexes
      where schemaname = 'public' and tablename = 'detalle_boletas'
        and indexname = 'detalle_boletas_id_solicitud_compra_idx'
    )
    and (
      select count(*) = 3
      from pg_trigger g
      join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and ((t.relname = 'detalle_boletas'  and g.tgname in ('detalle_boletas_marcar_solicitud_comprada',
                                                              'detalle_boletas_validar_exclusividad_solicitud'))
          or (t.relname = 'detalle_facturas' and g.tgname = 'detalle_facturas_validar_exclusividad_solicitud'))
    )
    and exists (
      select 1
      from pg_trigger g
      join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and t.relname = 'detalle_facturas' and g.tgname = 'detalle_facturas_marcar_solicitud_comprada'
    )
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'validar_exclusividad_solicitud'
        and p.prosecdef
        and array_to_string(p.proconfig, ',') like '%search_path=public%'
    )
    and exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'marcar_solicitud_comprada'
    )
    and (
      select count(*) = 2
      from pg_trigger g
      join pg_class t on t.oid = g.tgrelid
      join pg_namespace n on n.oid = t.relnamespace
      where not g.tgisinternal and g.tgenabled = 'O' and n.nspname = 'public'
        and g.tgname in ('detalle_facturas_bloquear_si_anulada', 'detalle_boletas_bloquear_si_anulada')
    )
    and (
      select count(*) = 4 from pg_policies
      where schemaname = 'public' and tablename = 'detalle_boletas'
    )
    and (
      select count(*) = 0 from (
        select id_solicitud_compra from public.detalle_facturas where id_solicitud_compra is not null
        intersect
        select id_solicitud_compra from public.detalle_boletas where id_solicitud_compra is not null
      ) x
    )
  ) as ok;
