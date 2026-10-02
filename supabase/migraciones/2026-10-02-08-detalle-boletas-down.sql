-- Reversa de 2026-10-02-08-detalle-boletas.sql. Una sola transacción.
--   * Elimina los movimientos de stock de líneas de boleta CON el trigger
--     movimientos_stock_aplicar activo: insumos.qty se REVIERTE (se resta lo que las
--     líneas de boleta habían sumado).
--   * Restaura movimientos_stock.id_detalle_factura NOT NULL y quita el CHECK, el índice
--     único y la columna id_detalle_boleta.
--   * Elimina triggers, función y la tabla detalle_boletas (con todas sus líneas).
-- boletas.monto NO se toca: ya contiene el TOTAL de las líneas, así que no se pierde dinero.
-- Lo que sí se pierde: el desglose de líneas (descripcion, cantidad, precio, insumo). Antes
-- de eliminarlas, avisa con raise notice cuántas boletas tienen más de una línea.

begin;

do $$
begin
  if to_regclass('public.detalle_boletas') is null then
    raise exception 'Reversa T5a: detalle_boletas no existe; la migración no está aplicada.';
  end if;
end
$$;

lock table public.detalle_boletas, public.boletas, public.movimientos_stock, public.insumos
  in share row exclusive mode;

do $$
declare
  v_multi bigint;
  v_lineas bigint;
  v_movs bigint;
  v_qty numeric;
begin
  select count(*) into v_multi from (
    select id_boleta from public.detalle_boletas group by id_boleta having count(*) > 1) x;
  select count(*) into v_lineas from public.detalle_boletas;
  select count(*), coalesce(sum(qty), 0) into v_movs, v_qty
  from public.movimientos_stock where id_detalle_boleta is not null;

  if v_multi > 0 then
    raise notice 'Reversa T5a: % boletas tienen más de una línea; se pierde el desglose (boletas.monto ya contiene el total).', v_multi;
  end if;
  raise notice 'Reversa T5a: se eliminan % líneas de boleta y % movimientos de stock (qty total %, se resta de insumos.qty).', v_lineas, v_movs, v_qty;
end
$$;

-- Con el trigger movimientos_stock_aplicar activo: cada DELETE resta su qty de insumos.qty.
delete from public.movimientos_stock where id_detalle_boleta is not null;

alter table public.movimientos_stock drop constraint if exists movimientos_stock_origen_check;
drop index if exists public.movimientos_stock_detalle_boleta_insumo_key;
alter table public.movimientos_stock drop column if exists id_detalle_boleta;

do $$
declare
  v_n bigint;
begin
  select count(*) into v_n from public.movimientos_stock where id_detalle_factura is null;
  if v_n > 0 then
    raise exception 'Reversa T5a: % movimientos sin línea de factura tras limpiar; no se puede restaurar NOT NULL.', v_n;
  end if;
end
$$;

alter table public.movimientos_stock alter column id_detalle_factura set not null;

drop trigger if exists detalle_boletas_generar_stock_ins on public.detalle_boletas;
drop trigger if exists detalle_boletas_generar_stock_upd on public.detalle_boletas;
drop function if exists public.generar_movimientos_stock_boleta();

comment on column public.boletas.monto is null;
drop table if exists public.detalle_boletas;

commit;
