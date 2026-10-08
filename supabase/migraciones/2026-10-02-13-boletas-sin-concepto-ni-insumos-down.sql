-- Reversa de 2026-10-02-13-boletas-sin-concepto-ni-insumos.sql. Una sola transacción.
-- RESTAURA LA ESTRUCTURA, NO LOS DATOS:
--   * boletas.concepto vuelve como `text not null` con un valor PROVISIONAL: la descripcion
--     de la primera línea de cada boleta (por created_at, id); 'Boleta' si no tiene líneas.
--     El concepto original no se recupera (la migración lo eliminó sin respaldo).
--   * detalle_boletas.id_insumo_proveedor vuelve vacío (null) con su FK e índice.
--   * movimientos_stock.id_detalle_boleta vuelve con su FK, el CHECK de origen único
--     (movimientos_stock_origen_check), el índice único y id_detalle_factura nullable.
--   * Se recrean generar_movimientos_stock_boleta() y sus triggers, y la rama de boletas de
--     sincronizar_stock_estado_documento() con su trigger boletas_sincronizar_stock_estado.
--   * ⚠ Los movimientos de boleta que la migración borró (y el stock que revirtió en
--     insumos.qty) NO se recrean. Las líneas de boleta existentes no generan movimientos
--     retroactivos (igual que vincular después no aplica stock).
-- Idempotente: cada paso comprueba antes si el objeto ya existe.

begin;

do $$
begin
  if to_regclass('public.boletas') is null
     or to_regclass('public.detalle_boletas') is null
     or to_regclass('public.movimientos_stock') is null then
    raise exception 'Reversa B1: faltan tablas (boletas, detalle_boletas, movimientos_stock).';
  end if;
  raise notice 'Reversa B1: los movimientos de boleta revertidos por la migración NO se recrean; el concepto de cada boleta será provisional (descripcion de su primera línea).';
end
$$;

lock table public.boletas, public.detalle_boletas, public.movimientos_stock, public.insumos
  in share row exclusive mode;

-- 1. boletas.concepto (provisional) --------------------------------------------------------------
alter table public.boletas
  add column if not exists concepto text;

update public.boletas b
set concepto = coalesce(
  (select d.descripcion
   from public.detalle_boletas d
   where d.id_boleta = b.id and btrim(d.descripcion) <> ''
   order by d.created_at, d.id
   limit 1),
  'Boleta')
where b.concepto is null;

alter table public.boletas
  alter column concepto set not null;

-- 2. detalle_boletas.id_insumo_proveedor (vacío) -----------------------------------------------------
alter table public.detalle_boletas
  add column if not exists id_insumo_proveedor uuid references public.insumos_proveedores (id);

create index if not exists detalle_boletas_id_insumo_proveedor_idx
  on public.detalle_boletas (id_insumo_proveedor);

comment on column public.detalle_boletas.id_insumo_proveedor is
  'Opcional: arriendo, sueldos y servicios no tienen insumo. Si está vinculado en la pivote, la línea mueve stock.';

-- 3. movimientos_stock admite líneas de boleta ---------------------------------------------------------
alter table public.movimientos_stock
  alter column id_detalle_factura drop not null;

alter table public.movimientos_stock
  add column if not exists id_detalle_boleta uuid references public.detalle_boletas (id) on delete cascade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint k
    join pg_class t on t.oid = k.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'movimientos_stock'
      and k.conname = 'movimientos_stock_origen_check'
  ) then
    alter table public.movimientos_stock
      add constraint movimientos_stock_origen_check
      check (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1);
  end if;
end
$$;

create unique index if not exists movimientos_stock_detalle_boleta_insumo_key
  on public.movimientos_stock (id_detalle_boleta, id_insumo);

-- 4. Función y triggers de stock de boletas ----------------------------------------------------------------
create or replace function public.generar_movimientos_stock_boleta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    delete from movimientos_stock where id_detalle_boleta = new.id;
  end if;

  insert into movimientos_stock (id_detalle_boleta, id_insumo, qty)
  select new.id, po.id_insumo_okima, new.cantidad * po.factor_conversion
  from insumos_proveedores_okima po
  where po.id_insumo_proveedor = new.id_insumo_proveedor;
  return null;
end;
$$;

drop trigger if exists detalle_boletas_generar_stock_ins on public.detalle_boletas;
create trigger detalle_boletas_generar_stock_ins
after insert on public.detalle_boletas
for each row
execute function public.generar_movimientos_stock_boleta();

drop trigger if exists detalle_boletas_generar_stock_upd on public.detalle_boletas;
create trigger detalle_boletas_generar_stock_upd
after update on public.detalle_boletas
for each row
when (old.cantidad is distinct from new.cantidad
      or old.id_insumo_proveedor is distinct from new.id_insumo_proveedor)
execute function public.generar_movimientos_stock_boleta();

-- 5. Sincronización de stock por estado: facturas y boletas ------------------------------------------------
create or replace function public.sincronizar_stock_estado_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revertir boolean := (new.estado_documento = 'anulado');
begin
  if tg_table_name = 'facturas' then
    update movimientos_stock m
    set revertido = v_revertir
    where m.revertido is distinct from v_revertir
      and m.id_detalle_factura in (select d.id from detalle_facturas d where d.id_factura = new.id);
  else
    update movimientos_stock m
    set revertido = v_revertir
    where m.revertido is distinct from v_revertir
      and m.id_detalle_boleta in (select d.id from detalle_boletas d where d.id_boleta = new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists boletas_sincronizar_stock_estado on public.boletas;
create trigger boletas_sincronizar_stock_estado
after update on public.boletas
for each row
when (old.estado_documento is distinct from new.estado_documento)
execute function public.sincronizar_stock_estado_documento();

comment on column public.boletas.estado_documento is
  'vigente | anulado. Anular revierte el stock (movimientos_stock.revertido) y excluye el documento de totales; solo contador/admin anula, solo admin reactiva.';

commit;
