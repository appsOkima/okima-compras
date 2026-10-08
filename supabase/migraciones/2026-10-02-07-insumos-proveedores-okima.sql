-- Sprint 2 / T4a: relación N:M insumo del proveedor <-> insumo Okima y stock por movimientos.
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas: si algo no cuadra, `raise exception` ANTES de tocar nada.
--      Bloquea escrituras en detalle_facturas / insumos_proveedores / insumos mientras dura.
--   2. Crea insumos_proveedores_okima (pivote; factor_conversion = unidades Okima por
--      unidad del proveedor, > 0, UNIQUE por par) y movimientos_stock (una fila por
--      línea e insumo, con el qty aplicado).
--   3. COPIA los datos: cada insumos_proveedores.id_insumo_okima no nulo pasa a la pivote con
--      factor = coalesce(nullif(cantidad_formato, 0), 1)  (antes, cantidad_formato = 0
--      sumaba 0; ahora cuenta 1), y cada detalle_facturas con id_insumo_stock y
--      qty_stock pasa a movimientos_stock SIN volver a sumar a insumos.qty (los
--      triggers de movimientos se crean después de la copia).
--   4. VERIFICA con raise exception: nº de vínculos y suma de qty por insumo.
--   5. Reescribe vista_solicitudes_pendientes (proveedores y notas vía pivote; mismas columnas).
--   6. Crea los triggers nuevos (movimientos_stock suma/resta/reaplica insumos.qty;
--      detalle_facturas genera movimientos) y recién entonces elimina los viejos
--      (calcular_stock_detalle / aplicar_stock_detalle) y las columnas
--      insumos_proveedores.id_insumo_okima y detalle_facturas.id_insumo_stock / qty_stock.
--   7. RLS permisivo (acceso_publico) en las tablas nuevas; el corte por rol es T3b.
-- cantidad_formato y formato_unidad se CONSERVAN como datos descriptivos del formato de compra.
-- Idempotente: si ya se aplicó, no copia ni elimina nada de nuevo.
-- IMPORTANTE: el frontend anterior deja de funcionar al aplicarla (lee id_insumo_okima):
-- aplicar y desplegar el frontend de T4b juntos, en una ventana corta.
-- Comprobación posterior: 2026-10-02-07-verificacion.sql.
-- Reversa: 2026-10-02-07-insumos-proveedores-okima-down.sql.

begin;

lock table public.detalle_facturas, public.insumos_proveedores, public.insumos
  in share row exclusive mode;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
declare
  v_n bigint;
begin
  if to_regclass('public.insumos') is null
     or to_regclass('public.insumos_proveedores') is null
     or to_regclass('public.detalle_facturas') is null
     or to_regclass('public.vista_solicitudes_pendientes') is null then
    raise exception 'T4a: faltan tablas o la vista base (insumos, insumos_proveedores, detalle_facturas, vista_solicitudes_pendientes). Aplicar antes las migraciones 01-06.';
  end if;

  -- La vista reescrita usa las notas de la migración 02.
  select count(*) into v_n
  from (values ('proveedores'), ('insumos_proveedores'), ('insumos'), ('solicitudes_compra')) t (tabla)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = t.tabla and c.column_name = 'notas'
  );
  if v_n > 0 then
    raise exception 'T4a: % tabla(s) sin columna notas; aplicar antes la migración 02 (notas universal).', v_n;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'insumos_proveedores' and column_name = 'id_insumo_okima') then
    -- factor_conversion exige > 0: una cantidad_formato negativa no se puede migrar.
    select count(*) into v_n from public.insumos_proveedores
    where id_insumo_okima is not null and cantidad_formato < 0;
    if v_n > 0 then
      raise exception 'T4a: % insumos_proveedores vinculados tienen cantidad_formato negativa; corregirlos antes (factor_conversion debe ser > 0).', v_n;
    end if;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'detalle_facturas' and column_name = 'id_insumo_stock') then
    -- El trigger viejo siempre llenaba ambos o ninguno; una mezcla indica datos manipulados.
    select count(*) into v_n from public.detalle_facturas
    where (id_insumo_stock is null) <> (qty_stock is null);
    if v_n > 0 then
      raise exception 'T4a: % líneas de factura tienen id_insumo_stock y qty_stock inconsistentes (solo uno es nulo); revisar antes de migrar.', v_n;
    end if;
  end if;
end
$$;

-- 2. Tablas nuevas --------------------------------------------------------------
create table if not exists public.insumos_proveedores_okima (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  id_insumo_proveedor  uuid not null references public.insumos_proveedores (id) on delete cascade,
  id_insumo_okima      uuid not null references public.insumos (id) on delete cascade,
  factor_conversion    numeric not null check (factor_conversion > 0),
  constraint insumos_proveedores_okima_par_key unique (id_insumo_proveedor, id_insumo_okima)
);

create index if not exists insumos_proveedores_okima_id_insumo_proveedor_idx
  on public.insumos_proveedores_okima (id_insumo_proveedor);
create index if not exists insumos_proveedores_okima_id_insumo_okima_idx
  on public.insumos_proveedores_okima (id_insumo_okima);

-- id_insumo sin cascade: borrar un insumo con movimientos falla a propósito, igual
-- que antes con detalle_facturas.id_insumo_stock (el historial de stock no se pierde en silencio).
-- Extensión prevista en T5 (boletas): id_detalle_factura pasará a nullable, se agregará
-- id_detalle_boleta uuid references detalle_boletas (id) on delete cascade y
-- CHECK (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1).
create table if not exists public.movimientos_stock (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  id_detalle_factura  uuid not null references public.detalle_facturas (id) on delete cascade,
  id_insumo           uuid not null references public.insumos (id),
  qty                 numeric not null
);

create unique index if not exists movimientos_stock_detalle_factura_insumo_key
  on public.movimientos_stock (id_detalle_factura, id_insumo);
create index if not exists movimientos_stock_id_insumo_idx on public.movimientos_stock (id_insumo);

-- 3 y 4. Copia de datos y verificación (los triggers de movimientos aún no existen) ---
do $$
declare
  v_origen bigint;
  v_copiados bigint;
  v_dif bigint;
  v_suma_origen numeric;
  v_suma_copiada numeric;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'insumos_proveedores' and column_name = 'id_insumo_okima') then
    insert into public.insumos_proveedores_okima (id_insumo_proveedor, id_insumo_okima, factor_conversion)
    select ip.id, ip.id_insumo_okima, coalesce(nullif(ip.cantidad_formato, 0), 1)
    from public.insumos_proveedores ip
    where ip.id_insumo_okima is not null
    on conflict (id_insumo_proveedor, id_insumo_okima) do nothing;

    select count(*) into v_origen from public.insumos_proveedores where id_insumo_okima is not null;
    select count(*) into v_copiados
    from public.insumos_proveedores ip
    join public.insumos_proveedores_okima po
      on po.id_insumo_proveedor = ip.id and po.id_insumo_okima = ip.id_insumo_okima
    where ip.id_insumo_okima is not null;
    if v_origen <> v_copiados then
      raise exception 'T4a: vínculos origen % <> migrados %; se aborta sin cambios.', v_origen, v_copiados;
    end if;
    raise notice 'T4a: % vínculos insumo_proveedor -> insumo Okima migrados a la pivote.', v_copiados;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'detalle_facturas' and column_name = 'id_insumo_stock') then
    insert into public.movimientos_stock (id_detalle_factura, id_insumo, qty)
    select d.id, d.id_insumo_stock, d.qty_stock
    from public.detalle_facturas d
    where d.id_insumo_stock is not null and d.qty_stock is not null
    on conflict (id_detalle_factura, id_insumo) do nothing;

    select count(*), coalesce(sum(qty_stock), 0) into v_origen, v_suma_origen
    from public.detalle_facturas where id_insumo_stock is not null and qty_stock is not null;
    select count(*), coalesce(sum(qty), 0) into v_copiados, v_suma_copiada from public.movimientos_stock;
    if v_origen <> v_copiados or v_suma_origen <> v_suma_copiada then
      raise exception 'T4a: movimientos copiados (% filas, suma %) no cuadran con el stock aplicado original (% filas, suma %).',
        v_copiados, v_suma_copiada, v_origen, v_suma_origen;
    end if;

    -- Misma comprobación por insumo (una suma total podría esconder diferencias que se compensan).
    select count(*) into v_dif
    from (select id_insumo_stock as id, sum(qty_stock) as s
          from public.detalle_facturas
          where id_insumo_stock is not null and qty_stock is not null
          group by id_insumo_stock) o
    full join (select id_insumo as id, sum(qty) as s from public.movimientos_stock group by id_insumo) m on m.id = o.id
    where o.s is distinct from m.s;
    if v_dif > 0 then
      raise exception 'T4a: % insumos con suma de movimientos distinta del stock aplicado original.', v_dif;
    end if;
    raise notice 'T4a: % movimientos copiados, suma % (verificado, sin reaplicar stock).', v_copiados, v_suma_copiada;
  end if;
end
$$;

-- 5. Vista (debe ir antes de eliminar id_insumo_okima, de la que depende la actual) ---
drop view if exists public.vista_solicitudes_pendientes;
create view public.vista_solicitudes_pendientes
with (security_invoker = true) as
select
  s.id,
  s.created_at,
  s.solicitante,
  s.id_insumo_okima,
  i.nombre                          as insumo_nombre,
  s.cantidad_solicitada,
  s.nivel_urgencia,
  s.fecha_esperada,
  s.estado,
  coalesce(sug.proveedores_sugeridos, '') as proveedores_sugeridos,
  s.notas,
  i.notas                           as notas_insumo,
  sug.notas_proveedores,
  sug.notas_catalogo
from public.solicitudes_compra s
join public.insumos i on i.id = s.id_insumo_okima
left join lateral (
  select
    string_agg(distinct p.nombre, ', ' order by p.nombre) as proveedores_sugeridos,
    -- Para la hoja impresa: solo las notas con contenido, una por línea.
    string_agg(distinct p.nombre || ': ' || btrim(p.notas), E'\n')
      filter (where btrim(coalesce(p.notas, '')) <> '') as notas_proveedores,
    string_agg(distinct p.nombre || ' · ' || ip.nombre || ': ' || btrim(ip.notas), E'\n')
      filter (where btrim(coalesce(ip.notas, '')) <> '') as notas_catalogo
  from public.insumos_proveedores_okima po
  join public.insumos_proveedores ip on ip.id = po.id_insumo_proveedor
  join public.proveedores p on p.id = ip.id_proveedor
  where po.id_insumo_okima = s.id_insumo_okima
) sug on true
where s.estado = 'Pendiente'
order by s.nivel_urgencia desc, s.fecha_esperada asc nulls last, s.created_at asc;

-- 6a. Triggers nuevos ------------------------------------------------------------
-- SECURITY DEFINER: el RLS por rol (T3b) impedirá a ciertos roles actualizar insumos
-- o escribir movimientos; el stock lo mueve siempre el trigger.
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
    -- UPDATE: revierte lo anterior y reaplica (cubre cambio de qty y de insumo).
    if new.qty is distinct from old.qty or new.id_insumo is distinct from old.id_insumo then
      update insumos set qty = qty - old.qty where id = old.id_insumo;
      update insumos set qty = qty + new.qty where id = new.id_insumo;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists movimientos_stock_aplicar on public.movimientos_stock;
create trigger movimientos_stock_aplicar
after insert or delete or update of qty, id_insumo on public.movimientos_stock
for each row
execute function public.aplicar_movimiento_stock();

-- Por cada fila de la pivote del insumo_proveedor de la línea: qty = cantidad × factor.
-- En UPDATE (solo si cambia cantidad o insumo_proveedor) se borran antes los
-- movimientos de la línea, lo que revierte el stock vía trigger, y se regeneran con
-- los valores nuevos (sirve también si cambian ambos campos a la vez).
-- Sin filas en la pivote no hay stock; vincular después NO lo aplica retroactivamente.
create or replace function public.generar_movimientos_stock_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    delete from movimientos_stock where id_detalle_factura = new.id;
  end if;

  insert into movimientos_stock (id_detalle_factura, id_insumo, qty)
  select new.id, po.id_insumo_okima, new.cantidad * po.factor_conversion
  from insumos_proveedores_okima po
  where po.id_insumo_proveedor = new.id_insumo_proveedor;
  return null;
end;
$$;

drop trigger if exists detalle_facturas_generar_stock_ins on public.detalle_facturas;
create trigger detalle_facturas_generar_stock_ins
after insert on public.detalle_facturas
for each row
execute function public.generar_movimientos_stock_factura();

drop trigger if exists detalle_facturas_generar_stock_upd on public.detalle_facturas;
create trigger detalle_facturas_generar_stock_upd
after update on public.detalle_facturas
for each row
when (old.cantidad is distinct from new.cantidad
      or old.id_insumo_proveedor is distinct from new.id_insumo_proveedor)
execute function public.generar_movimientos_stock_factura();

-- 6b. Retiro de lo viejo (ya con la copia verificada y los triggers nuevos activos) --
drop trigger if exists detalle_facturas_calcular_stock on public.detalle_facturas;
drop trigger if exists detalle_facturas_aplicar_stock on public.detalle_facturas;
drop function if exists public.calcular_stock_detalle();
drop function if exists public.aplicar_stock_detalle();

drop index if exists public.detalle_facturas_id_insumo_stock_idx;
alter table public.detalle_facturas
  drop column if exists id_insumo_stock,
  drop column if exists qty_stock;

drop index if exists public.insumos_proveedores_id_insumo_okima_idx;
alter table public.insumos_proveedores drop column if exists id_insumo_okima;

-- 7. RLS permisivo, igual que el resto (el corte por rol es T3b) ---------------------
alter table public.insumos_proveedores_okima enable row level security;
alter table public.movimientos_stock enable row level security;

drop policy if exists "acceso_publico" on public.insumos_proveedores_okima;
create policy "acceso_publico" on public.insumos_proveedores_okima
  for all to anon, authenticated using (true) with check (true);
drop policy if exists "acceso_publico" on public.movimientos_stock;
create policy "acceso_publico" on public.movimientos_stock
  for all to anon, authenticated using (true) with check (true);

commit;
