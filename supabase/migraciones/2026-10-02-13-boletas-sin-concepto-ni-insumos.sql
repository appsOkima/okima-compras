-- Boletas sin concepto ni insumos del proveedor (feature boletas-sin-concepto-ni-insumos / B1).
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas (`raise exception` ANTES de tocar nada; se omiten las que ya no
--      aplican si la migración está parcial o totalmente aplicada):
--        * existen las tablas y la migración 12 (detalle_boletas.id_solicitud_compra);
--        * toda boleta tiene al menos una línea con descripcion no vacía. Es una RED DE
--          SEGURIDAD, no un respaldo: boletas.concepto se elimina sin respaldo porque ya está
--          copiado a detalle_boletas.descripcion, y una boleta sin línea con descripcion perdería
--          su único nombre;
--        * ninguna vista, índice, política ni función de public menciona `concepto`.
--      Bloquea escrituras en boletas / detalle_boletas / movimientos_stock / insumos y guarda la
--      foto de sum(insumos.qty).
--   2. Retira el stock de boletas: elimina los triggers detalle_boletas_generar_stock_ins/upd y
--      borra los movimientos de boleta (id_detalle_boleta no nulo) CON el trigger
--      movimientos_stock_aplicar activo, de modo que insumos.qty se REVIERTE (los movimientos
--      de boletas anuladas ya estaban revertidos: el trigger no resta dos veces). Avisa con
--      raise notice cuántos movimientos y qué qty por insumo se revierte, y comprueba con
--      raise exception que sum(insumos.qty) cambió exactamente en lo revertido.
--   3. movimientos_stock: elimina el CHECK movimientos_stock_origen_check, el índice único
--      movimientos_stock_detalle_boleta_insumo_key y la columna id_detalle_boleta (con su FK);
--      id_detalle_factura vuelve a NOT NULL (comprobado antes: no quedan movimientos sin factura).
--   4. sincronizar_stock_estado_documento() queda solo para facturas; se elimina el trigger
--      boletas_sincronizar_stock_estado. Anular una boleta ya no toca stock. Se MANTIENEN
--      boletas_validar_estado y detalle_boletas_bloquear_si_anulada.
--   5. Elimina la función generar_movimientos_stock_boleta() (después de sus triggers).
--   6. detalle_boletas: elimina el índice detalle_boletas_id_insumo_proveedor_idx y la columna
--      id_insumo_proveedor (con su FK).
--   7. boletas: elimina la columna concepto. Se actualiza el comment de estado_documento.
-- Se MANTIENEN: detalle_boletas.id_solicitud_compra (FK, trigger 'Comprada', exclusividad),
-- boletas.id_subcategoria / id_proveedor / numero_documento / monto / notas, pagos, estado
-- anulado y todas las políticas RLS (ninguna menciona columnas eliminadas).
-- Idempotente: cada paso comprueba antes si el objeto existe; re-ejecutar no cambia nada.
-- Comprobación posterior: 2026-10-02-13-verificacion.sql (ejecutarla COMPLETA).
-- Reversa: 2026-10-02-13-boletas-sin-concepto-ni-insumos-down.sql (NO recrea los movimientos
-- de boleta ya revertidos ni el concepto original).

begin;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
declare
  v_n bigint;
  v_tiene_concepto boolean;
begin
  if to_regclass('public.boletas') is null
     or to_regclass('public.detalle_boletas') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('public.insumos') is null
     or to_regclass('public.facturas') is null
     or to_regclass('public.detalle_facturas') is null then
    raise exception 'B1: faltan tablas (boletas, detalle_boletas, movimientos_stock, insumos, facturas, detalle_facturas). Aplicar antes las migraciones 01-12.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'detalle_boletas' and column_name = 'id_solicitud_compra'
  ) then
    raise exception 'B1: detalle_boletas no tiene id_solicitud_compra (migración 12 sin aplicar).';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'boletas' and column_name = 'concepto'
  ) into v_tiene_concepto;

  if v_tiene_concepto then
    -- Red de seguridad: sin línea con descripcion no vacía se perdería el único nombre de la boleta.
    select count(*) into v_n
    from public.boletas b
    where not exists (
      select 1 from public.detalle_boletas d
      where d.id_boleta = b.id and btrim(d.descripcion) <> ''
    );
    if v_n > 0 then
      raise exception 'B1: % boletas no tienen ninguna línea con descripcion no vacía (sin líneas, o con descripcion vacía). Corregirlas antes: al eliminar concepto perderían su único nombre.', v_n;
    end if;

    -- Dependencias de `concepto` que la migración no sabe ajustar.
    select count(*) into v_n from pg_views
    where schemaname = 'public' and definition ilike '%concepto%';
    if v_n > 0 then
      raise exception 'B1: % vistas de public mencionan concepto; ajustarlas antes.', v_n;
    end if;

    select count(*) into v_n from pg_indexes
    where schemaname = 'public' and indexdef ilike '%concepto%';
    if v_n > 0 then
      raise exception 'B1: % índices de public mencionan concepto; ajustarlos antes.', v_n;
    end if;

    select count(*) into v_n from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ilike '%concepto%' or coalesce(with_check, '') ilike '%concepto%');
    if v_n > 0 then
      raise exception 'B1: % políticas RLS de public mencionan concepto; ajustarlas antes.', v_n;
    end if;

    select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ilike '%concepto%';
    if v_n > 0 then
      raise exception 'B1: % funciones de public mencionan concepto; ajustarlas antes.', v_n;
    end if;
  end if;
end
$$;

lock table public.boletas, public.detalle_boletas, public.movimientos_stock, public.insumos
  in share row exclusive mode;

-- Foto del stock total (variable local a la transacción).
select set_config('okima.b1_stock', coalesce(sum(qty), 0)::text, true) from public.insumos;

-- 2. Stock de boletas: triggers fuera y movimientos de boleta borrados CON el trigger activo ----
drop trigger if exists detalle_boletas_generar_stock_ins on public.detalle_boletas;
drop trigger if exists detalle_boletas_generar_stock_upd on public.detalle_boletas;

do $$
declare
  v_tiene_col boolean;
  v_movs bigint := 0;
  v_revertir numeric := 0;
  v_antes numeric := current_setting('okima.b1_stock')::numeric;
  v_despues numeric;
  r record;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'movimientos_stock' and column_name = 'id_detalle_boleta'
  ) into v_tiene_col;

  if v_tiene_col then
    -- Qué se va a revertir: solo los movimientos no revertidos (los de boletas anuladas ya
    -- salieron de insumos.qty).
    execute 'select count(*) from public.movimientos_stock where id_detalle_boleta is not null' into v_movs;
    execute 'select coalesce(sum(qty), 0) from public.movimientos_stock where id_detalle_boleta is not null and not revertido'
      into v_revertir;

    for r in execute
      'select i.nombre, count(*) as n, sum(m.qty) as q
       from public.movimientos_stock m join public.insumos i on i.id = m.id_insumo
       where m.id_detalle_boleta is not null and not m.revertido
       group by i.id, i.nombre order by i.nombre'
    loop
      raise notice 'B1: se revierte % de "%" (% movimientos de boleta).', r.q, r.nombre, r.n;
    end loop;

    -- El trigger movimientos_stock_aplicar (after delete) resta old.qty si no estaba revertido.
    execute 'delete from public.movimientos_stock where id_detalle_boleta is not null';
  end if;

  select coalesce(sum(qty), 0) into v_despues from public.insumos;
  if v_despues <> v_antes - v_revertir then
    raise exception 'B1: sum(insumos.qty) pasó de % a %, se esperaba % (revertir %); se aborta sin cambios.',
      v_antes, v_despues, v_antes - v_revertir, v_revertir;
  end if;

  raise notice 'B1: % movimientos de boleta eliminados; stock total revertido: % (de % a %).',
    v_movs, v_revertir, v_antes, v_despues;
end
$$;

-- 3. movimientos_stock vuelve a ser solo de facturas ------------------------------------------
do $$
declare
  v_n bigint;
begin
  select count(*) into v_n from public.movimientos_stock where id_detalle_factura is null;
  if v_n > 0 then
    raise exception 'B1: % movimientos de stock no tienen id_detalle_factura; no se puede volver a NOT NULL.', v_n;
  end if;
end
$$;

alter table public.movimientos_stock
  drop constraint if exists movimientos_stock_origen_check;
drop index if exists public.movimientos_stock_detalle_boleta_insumo_key;
alter table public.movimientos_stock
  drop column if exists id_detalle_boleta;
alter table public.movimientos_stock
  alter column id_detalle_factura set not null;

-- 4. Sincronización de stock por estado: solo facturas -----------------------------------------
drop trigger if exists boletas_sincronizar_stock_estado on public.boletas;

-- Al anular una factura marca revertido = true en los movimientos de todas sus líneas; al
-- reactivar los vuelve a false. El trigger de movimientos_stock ajusta insumos.qty.
create or replace function public.sincronizar_stock_estado_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revertir boolean := (new.estado_documento = 'anulado');
begin
  update movimientos_stock m
  set revertido = v_revertir
  where m.revertido is distinct from v_revertir
    and m.id_detalle_factura in (select d.id from detalle_facturas d where d.id_factura = new.id);
  return null;
end;
$$;

-- 5. Función de stock de boletas (sus triggers ya no existen) ----------------------------------
drop function if exists public.generar_movimientos_stock_boleta();

-- 6. detalle_boletas sin insumo del proveedor --------------------------------------------------
drop index if exists public.detalle_boletas_id_insumo_proveedor_idx;
alter table public.detalle_boletas
  drop column if exists id_insumo_proveedor;

-- 7. boletas sin concepto ------------------------------------------------------------------------
alter table public.boletas
  drop column if exists concepto;

comment on column public.boletas.estado_documento is
  'vigente | anulado. Anular excluye el documento de totales (no toca stock: las boletas no mueven stock); solo contador/admin anula, solo admin reactiva.';

-- 8. Comprobaciones finales --------------------------------------------------------------------
do $$
declare
  v_n bigint;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'boletas' and column_name = 'concepto')
        or (table_name = 'detalle_boletas' and column_name = 'id_insumo_proveedor')
        or (table_name = 'movimientos_stock' and column_name = 'id_detalle_boleta'))
  ) then
    raise exception 'B1: quedan columnas que debían eliminarse.';
  end if;

  select count(*) into v_n
  from public.boletas b
  where not exists (select 1 from public.detalle_boletas d where d.id_boleta = b.id);
  raise notice 'B1: migración lista. % boletas sin líneas (informativo); stock total %.',
    v_n, (select coalesce(sum(qty), 0) from public.insumos);
end
$$;

commit;
