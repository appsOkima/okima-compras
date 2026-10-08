-- Reversa de 2026-10-02-09-estado-anulado.sql. Una sola transacción.
-- ORDEN DE REVERSA: la migración 13 eliminó la rama de boletas de sincronizar_stock_estado_documento()
-- y el trigger boletas_sincronizar_stock_estado (y movimientos_stock.id_detalle_boleta). Esta reversa
-- asume el estado posterior a la 08 y anterior a la 13: revertir primero 13-down (y 12, 11, 10 -down),
-- y después ESTE archivo; el -08-detalle-boletas-down.sql va a continuación. Si id_detalle_boleta no
-- existe, aborta con un error claro y no cambia nada.
-- Comportamiento con documentos anulados (documentado, no silencioso):
--   * Los documentos anulados VUELVEN A CONTAR: sus movimientos revertidos se ponen en
--     revertido = false con el trigger NUEVO todavía activo, que suma de vuelta su qty a
--     insumos.qty. Después se restaura la versión anterior de aplicar_movimiento_stock() y
--     su trigger, y se elimina la columna revertido. Así insumos.qty queda consistente con
--     el modelo anterior (todo movimiento existente cuenta).
--   * Se pierde la marca de anulación (estado, quién, cuándo, motivo): las columnas se
--     eliminan, y los documentos anulados quedan como documentos normales. Un raise notice
--     informa cuántos documentos y movimientos se ven afectados; si importa conservar el
--     rastro, respaldar antes: select id, estado_documento, anulado_por, anulado_at,
--     motivo_anulacion from facturas / boletas where estado_documento = 'anulado'.
-- No toca datos de negocio (totales, líneas).

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'movimientos_stock' and column_name = 'id_detalle_boleta'
  ) then
    raise exception 'Reversa T6a: movimientos_stock.id_detalle_boleta no existe (la migración 13 está aplicada). Antes hay que revertir la 13 con 2026-10-02-13-boletas-sin-concepto-ni-insumos-down.sql (y las posteriores a la 09, en orden inverso).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'facturas' and column_name = 'estado_documento'
  ) then
    raise exception 'Reversa T6a: facturas.estado_documento no existe; la migración no está aplicada.';
  end if;
end
$$;

lock table public.facturas, public.boletas, public.detalle_facturas, public.detalle_boletas,
           public.movimientos_stock, public.insumos
  in share row exclusive mode;

do $$
declare
  v_fact bigint;
  v_bol bigint;
  v_movs bigint;
  v_qty numeric;
begin
  select count(*) into v_fact from public.facturas where estado_documento = 'anulado';
  select count(*) into v_bol from public.boletas where estado_documento = 'anulado';
  select count(*), coalesce(sum(qty), 0) into v_movs, v_qty
  from public.movimientos_stock where revertido;

  raise notice 'Reversa T6a: % facturas y % boletas anuladas vuelven a contar; se reaplican % movimientos (qty total % se suma de vuelta a insumos.qty). Se pierde la marca de anulación.',
    v_fact, v_bol, v_movs, v_qty;
end
$$;

-- Triggers y funciones de documento y de líneas -----------------------------------------------
drop trigger if exists detalle_facturas_bloquear_si_anulada on public.detalle_facturas;
drop trigger if exists detalle_boletas_bloquear_si_anulada on public.detalle_boletas;
drop trigger if exists facturas_sincronizar_stock_estado on public.facturas;
drop trigger if exists boletas_sincronizar_stock_estado on public.boletas;
drop trigger if exists facturas_validar_estado on public.facturas;
drop trigger if exists boletas_validar_estado on public.boletas;

-- Reaplica lo revertido con el trigger NUEVO aún activo (suma a insumos.qty).
update public.movimientos_stock set revertido = false where revertido;

drop function if exists public.bloquear_lineas_documento_anulado();
drop function if exists public.sincronizar_stock_estado_documento();
drop function if exists public.validar_estado_documento();

-- Restaura aplicar_movimiento_stock() y su trigger tal como los dejó la migración 07 ----------------
drop trigger if exists movimientos_stock_aplicar on public.movimientos_stock;

create or replace function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update insumos set qty = qty + new.qty where id = new.id_insumo;
  elsif tg_op = 'DELETE' then
    update insumos set qty = qty - old.qty where id = old.id_insumo;
  else
    if new.qty is distinct from old.qty or new.id_insumo is distinct from old.id_insumo then
      update insumos set qty = qty - old.qty where id = old.id_insumo;
      update insumos set qty = qty + new.qty where id = new.id_insumo;
    end if;
  end if;
  return null;
end;
$$;

create trigger movimientos_stock_aplicar
after insert or delete or update of qty, id_insumo on public.movimientos_stock
for each row
execute function public.aplicar_movimiento_stock();

alter table public.movimientos_stock drop column if exists revertido;

-- Columnas, índices y tipo ---------------------------------------------------------------------------
drop index if exists public.facturas_anuladas_idx;
drop index if exists public.boletas_anuladas_idx;

alter table public.facturas
  drop column if exists estado_documento,
  drop column if exists anulado_por,
  drop column if exists anulado_at,
  drop column if exists motivo_anulacion;

alter table public.boletas
  drop column if exists estado_documento,
  drop column if exists anulado_por,
  drop column if exists anulado_at,
  drop column if exists motivo_anulacion;

drop type if exists public.estado_documento;

commit;
