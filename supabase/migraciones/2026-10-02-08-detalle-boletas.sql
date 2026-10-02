-- Sprint 2 / T5a: líneas de boleta (detalle_boletas) y stock desde boletas.
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas: si algo no cuadra, `raise exception` ANTES de tocar nada
--      (exige las migraciones 01-07). Bloquea escrituras en boletas / movimientos_stock /
--      insumos mientras dura.
--   2. Crea detalle_boletas (descripcion, id_insumo_proveedor OPCIONAL, cantidad, precio,
--      subtotal). Sin columna notas (decisión del usuario) y sin id_solicitud_compra (T8).
--      id_insumo_proveedor SIN cascade, igual que detalle_facturas: no se puede borrar un
--      insumo del proveedor que tenga líneas.
--   3. boletas.monto SE MANTIENE y pasa a ser el TOTAL de las líneas. Lo calcula y lo
--      guarda la interfaz (como el total de facturas); la base NO lo recalcula ni valida.
--      subtotal tampoco lo calcula la base: la interfaz guarda round(cantidad × precio).
--      precio = monto por unidad en CLP, IVA incluido según la boleta (sin descuento ni
--      IVA discriminado).
--   4. MIGRA los datos: cada boleta SIN líneas recibe UNA línea con descripcion = concepto,
--      id_insumo_proveedor = null, cantidad = 1, precio = subtotal = monto. Idempotente
--      (solo boletas sin líneas). Verifica con raise exception que Σ subtotal = Σ monto
--      de lo migrado y que no queda ninguna boleta sin líneas. Esas líneas no tienen
--      insumo, así que no generan stock ni movimientos.
--   5. Extiende movimientos_stock: id_detalle_factura pasa a nullable, se agrega
--      id_detalle_boleta (FK on delete cascade), CHECK num_nonnulls(...) = 1 y un índice
--      único (id_detalle_boleta, id_insumo). El índice único existente
--      (id_detalle_factura, id_insumo) se conserva; con NULL no chocan entre sí.
--      El trigger movimientos_stock_aplicar suma/resta por id_insumo y sirve igual.
--   6. Crea generar_movimientos_stock_boleta() (SECURITY DEFINER, search_path fijo) y sus
--      dos triggers (insert / update con WHEN), análogos a los de facturas: por cada fila de
--      la pivote del insumo_proveedor de la línea, movimiento con qty = cantidad × factor.
--      Sin insumo_proveedor o sin filas en la pivote: sin stock. Borrar una línea o la
--      boleta revierte el stock por cascade sobre movimientos_stock.
--   7. RLS permisivo (acceso_publico) en la tabla nueva; el corte por rol es T3b.
-- NO se tocan vista_solicitudes_pendientes ni el Resumen (siguen sumando boletas.monto hasta T7).
-- Idempotente: si ya se aplicó, no vuelve a migrar ni a crear nada.
-- Comprobación posterior: 2026-10-02-08-verificacion.sql.
-- Reversa: 2026-10-02-08-detalle-boletas-down.sql.

begin;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
declare
  v_n bigint;
begin
  if to_regclass('public.boletas') is null
     or to_regclass('public.insumos') is null
     or to_regclass('public.insumos_proveedores') is null
     or to_regclass('public.insumos_proveedores_okima') is null
     or to_regclass('public.movimientos_stock') is null then
    raise exception 'T5a: faltan tablas (boletas, insumos, insumos_proveedores, insumos_proveedores_okima, movimientos_stock). Aplicar antes las migraciones 01-07.';
  end if;

  if to_regprocedure('public.aplicar_movimiento_stock()') is null then
    raise exception 'T5a: falta la función aplicar_movimiento_stock() de la migración 07; sin ella los movimientos de boleta no moverían stock.';
  end if;

  -- monto es not null en el esquema; se comprueba igual para abortar con mensaje claro si
  -- alguien relajó la restricción (no hay forma segura de inventar el monto de la línea).
  select count(*) into v_n from public.boletas where monto is null;
  if v_n > 0 then
    raise exception 'T5a: % boletas tienen monto nulo; corregirlas antes (la línea migrada necesita precio y subtotal).', v_n;
  end if;
end
$$;

lock table public.boletas, public.movimientos_stock, public.insumos
  in share row exclusive mode;

-- 2. Tabla de líneas ------------------------------------------------------------
create table if not exists public.detalle_boletas (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  id_boleta            uuid not null references public.boletas (id) on delete cascade,
  descripcion          text not null,
  id_insumo_proveedor  uuid references public.insumos_proveedores (id),
  cantidad             numeric not null default 1 check (cantidad > 0),
  precio               numeric not null,
  subtotal             numeric not null
);

create index if not exists detalle_boletas_id_boleta_idx
  on public.detalle_boletas (id_boleta);
create index if not exists detalle_boletas_id_insumo_proveedor_idx
  on public.detalle_boletas (id_insumo_proveedor);

comment on table public.detalle_boletas is
  'Líneas de boleta. boletas.monto es el total de estas líneas (lo calcula y guarda la interfaz; la base no lo recalcula).';
comment on column public.detalle_boletas.id_insumo_proveedor is
  'Opcional: arriendo, sueldos y servicios no tienen insumo. Si está vinculado en la pivote, la línea mueve stock.';
comment on column public.detalle_boletas.precio is
  'CLP por unidad, IVA incluido según la boleta (sin descuento ni IVA discriminado).';
comment on column public.detalle_boletas.subtotal is
  'Calculado por la interfaz: round(cantidad × precio). La base no lo calcula.';
comment on column public.boletas.monto is
  'Total de la boleta en CLP = suma de subtotal de sus líneas (detalle_boletas). Lo calcula y guarda la interfaz; la base no lo recalcula.';

-- 3 y 4. Migración de datos y verificación -----------------------------------------
do $$
declare
  v_pend bigint;
  v_n bigint;
  v_suma_lineas numeric;
  v_suma_monto numeric;
begin
  select count(*) into v_pend
  from public.boletas b
  where not exists (select 1 from public.detalle_boletas d where d.id_boleta = b.id);

  with ins as (
    insert into public.detalle_boletas (id_boleta, descripcion, id_insumo_proveedor, cantidad, precio, subtotal)
    select b.id, b.concepto, null, 1, b.monto, b.monto
    from public.boletas b
    where not exists (select 1 from public.detalle_boletas d where d.id_boleta = b.id)
    returning id_boleta, subtotal
  )
  select count(*), coalesce(sum(ins.subtotal), 0), coalesce(sum(b.monto), 0)
  into v_n, v_suma_lineas, v_suma_monto
  from ins
  join public.boletas b on b.id = ins.id_boleta;

  if v_n <> v_pend then
    raise exception 'T5a: boletas sin líneas % <> líneas creadas %; se aborta sin cambios.', v_pend, v_n;
  end if;
  if v_suma_lineas <> v_suma_monto then
    raise exception 'T5a: suma de subtotales migrados (%) distinta de la suma de monto de esas boletas (%).', v_suma_lineas, v_suma_monto;
  end if;

  select count(*) into v_n
  from public.boletas b
  where not exists (select 1 from public.detalle_boletas d where d.id_boleta = b.id);
  if v_n > 0 then
    raise exception 'T5a: % boletas siguen sin líneas tras migrar.', v_n;
  end if;

  raise notice 'T5a: % boletas migradas a una línea única (total %).', v_pend, v_suma_monto;
end
$$;

-- 5. movimientos_stock admite líneas de boleta ---------------------------------------
alter table public.movimientos_stock
  alter column id_detalle_factura drop not null;

alter table public.movimientos_stock
  add column if not exists id_detalle_boleta uuid references public.detalle_boletas (id) on delete cascade;

-- Cada movimiento nace de una línea de factura O de una línea de boleta, nunca de ambas
-- ni de ninguna. Las filas existentes (todas de factura) cumplen el CHECK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.movimientos_stock'::regclass
      and conname = 'movimientos_stock_origen_check'
  ) then
    alter table public.movimientos_stock
      add constraint movimientos_stock_origen_check
      check (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1);
  end if;
end
$$;

create unique index if not exists movimientos_stock_detalle_boleta_insumo_key
  on public.movimientos_stock (id_detalle_boleta, id_insumo);

-- 6. Triggers de stock para boletas -------------------------------------------------------
-- Igual que generar_movimientos_stock_factura: por cada fila de la pivote del
-- insumo_proveedor de la línea, qty = cantidad × factor_conversion (el trigger de
-- movimientos_stock suma a insumos.qty). En UPDATE (solo si cambia cantidad o
-- insumo_proveedor) se borran antes los movimientos de la línea, lo que revierte el
-- stock vía trigger, y se regeneran. Sin insumo_proveedor (null) o sin filas en la
-- pivote no hay stock; vincular después NO lo aplica retroactivamente.
-- SECURITY DEFINER: el RLS por rol (T3b) puede impedir escribir movimientos_stock directamente.
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

-- 7. RLS permisivo, igual que el resto (el corte por rol es T3b) ---------------------------
alter table public.detalle_boletas enable row level security;

drop policy if exists "acceso_publico" on public.detalle_boletas;
create policy "acceso_publico" on public.detalle_boletas
  for all to anon, authenticated using (true) with check (true);

commit;
