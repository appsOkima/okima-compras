-- Reversa de 2026-10-02-07-insumos-proveedores-okima.sql. Una sola transacción.
--   * Restaura insumos_proveedores.id_insumo_okima desde la pivote. Si un
--     insumo_proveedor tiene varias filas, conserva solo UNA (la de menor id) y lo
--     avisa con raise notice (se pierden los demás vínculos y sus factores).
--   * Restaura detalle_facturas.id_insumo_stock / qty_stock desde movimientos_stock
--     (si una línea tiene varios movimientos, conserva el de menor id y avisa).
--     insumos.qty NO se toca: conserva el stock actual tal cual está.
--   * Recrea los triggers y funciones antiguos (calcular_stock_detalle / aplicar_stock_detalle)
--     y la vista de la migración 04; elimina las tablas nuevas y sus triggers.
-- Los datos creados después de aplicar la migración que no caben en el esquema viejo
-- (vínculos múltiples, líneas con varios insumos) se pierden: los avisos lo cuentan.
-- Con la reversa aplicada, el stock de esas líneas ya no se revierte por completo al
-- editarlas o borrarlas. Revisar los avisos antes de confiar en el stock.

begin;

lock table public.detalle_facturas, public.insumos_proveedores, public.insumos
  in share row exclusive mode;

-- Comprobación previa: sin pivote y sin columna no hay de dónde restaurar.
do $$
begin
  if to_regclass('public.insumos_proveedores_okima') is null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'insumos_proveedores' and column_name = 'id_insumo_okima') then
    raise exception 'Reversa T4a: no existe la pivote ni la columna id_insumo_okima; la migración no está aplicada.';
  end if;
end
$$;

-- Fuera los triggers nuevos de detalle_facturas (para no generar movimientos al restaurar).
drop trigger if exists detalle_facturas_generar_stock_ins on public.detalle_facturas;
drop trigger if exists detalle_facturas_generar_stock_upd on public.detalle_facturas;

-- La vista nueva depende de la pivote; se elimina antes de poder borrar la tabla.
drop view if exists public.vista_solicitudes_pendientes;

-- Columnas antiguas.
alter table public.insumos_proveedores
  add column if not exists id_insumo_okima uuid references public.insumos (id) on delete set null;
create index if not exists insumos_proveedores_id_insumo_okima_idx
  on public.insumos_proveedores (id_insumo_okima);

alter table public.detalle_facturas
  add column if not exists id_insumo_stock uuid references public.insumos (id),
  add column if not exists qty_stock numeric;
create index if not exists detalle_facturas_id_insumo_stock_idx
  on public.detalle_facturas (id_insumo_stock);

-- Restauración de datos.
do $$
declare
  v_multi bigint;
  v_difiere bigint;
  v_n bigint;
begin
  if to_regclass('public.insumos_proveedores_okima') is not null then
    select count(*) into v_multi from (
      select id_insumo_proveedor from public.insumos_proveedores_okima
      group by id_insumo_proveedor having count(*) > 1) x;
    if v_multi > 0 then
      raise notice 'Reversa T4a: % insumos_proveedores tienen varios vínculos; se conserva solo el de menor id.', v_multi;
    end if;

    update public.insumos_proveedores ip
    set id_insumo_okima = u.id_insumo_okima
    from (
      select distinct on (id_insumo_proveedor) id_insumo_proveedor, id_insumo_okima
      from public.insumos_proveedores_okima
      order by id_insumo_proveedor, id
    ) u
    where ip.id = u.id_insumo_proveedor;

    -- El trigger viejo usa cantidad_formato como factor; avisa donde no coincide.
    select count(*) into v_difiere
    from public.insumos_proveedores ip
    join public.insumos_proveedores_okima po
      on po.id_insumo_proveedor = ip.id and po.id_insumo_okima = ip.id_insumo_okima
    where po.factor_conversion is distinct from coalesce(ip.cantidad_formato, 1);
    if v_difiere > 0 then
      raise notice 'Reversa T4a: % vínculos tienen factor_conversion distinto de coalesce(cantidad_formato, 1); con el trigger viejo las líneas nuevas sumarán cantidad_formato, no el factor.', v_difiere;
    end if;
  end if;

  if to_regclass('public.movimientos_stock') is not null then
    select count(*) into v_multi from (
      select id_detalle_factura from public.movimientos_stock
      group by id_detalle_factura having count(*) > 1) x;
    if v_multi > 0 then
      raise notice 'Reversa T4a: % líneas de factura tienen varios movimientos de stock; se conserva solo el de menor id (el stock de insumos.qty no se modifica).', v_multi;
    end if;

    update public.detalle_facturas d
    set id_insumo_stock = m.id_insumo, qty_stock = m.qty
    from (
      select distinct on (id_detalle_factura) id_detalle_factura, id_insumo, qty
      from public.movimientos_stock
      order by id_detalle_factura, id
    ) m
    where d.id = m.id_detalle_factura;

    select count(*) into v_n from public.movimientos_stock;
    raise notice 'Reversa T4a: % movimientos de stock en la tabla que se elimina.', v_n;
  end if;
end
$$;

-- Funciones y triggers antiguos (los de la migración original del stock).
create or replace function public.calcular_stock_detalle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Editar otros campos de la línea conserva el stock ya aplicado.
  if tg_op = 'UPDATE'
     and new.cantidad = old.cantidad
     and new.id_insumo_proveedor = old.id_insumo_proveedor then
    new.id_insumo_stock := old.id_insumo_stock;
    new.qty_stock := old.qty_stock;
    return new;
  end if;

  select ip.id_insumo_okima, new.cantidad * coalesce(ip.cantidad_formato, 1)
  into new.id_insumo_stock, new.qty_stock
  from insumos_proveedores ip
  where ip.id = new.id_insumo_proveedor;

  if new.id_insumo_stock is null then
    new.qty_stock := null;
  end if;
  return new;
end;
$$;

create or replace function public.aplicar_stock_detalle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.id_insumo_stock is not distinct from old.id_insumo_stock
     and new.qty_stock is not distinct from old.qty_stock then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.id_insumo_stock is not null then
    update insumos set qty = qty - old.qty_stock where id = old.id_insumo_stock;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.id_insumo_stock is not null then
    update insumos set qty = qty + new.qty_stock where id = new.id_insumo_stock;
  end if;
  return null;
end;
$$;

drop trigger if exists detalle_facturas_calcular_stock on public.detalle_facturas;
create trigger detalle_facturas_calcular_stock
before insert or update on public.detalle_facturas
for each row
execute function public.calcular_stock_detalle();

drop trigger if exists detalle_facturas_aplicar_stock on public.detalle_facturas;
create trigger detalle_facturas_aplicar_stock
after insert or update or delete on public.detalle_facturas
for each row
execute function public.aplicar_stock_detalle();

-- Vista de la migración 04.
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
    string_agg(distinct p.nombre || ': ' || btrim(p.notas), E'\n')
      filter (where btrim(coalesce(p.notas, '')) <> '') as notas_proveedores,
    string_agg(distinct p.nombre || ' · ' || ip.nombre || ': ' || btrim(ip.notas), E'\n')
      filter (where btrim(coalesce(ip.notas, '')) <> '') as notas_catalogo
  from public.insumos_proveedores ip
  join public.proveedores p on p.id = ip.id_proveedor
  where ip.id_insumo_okima = s.id_insumo_okima
) sug on true
where s.estado = 'Pendiente'
order by s.nivel_urgencia desc, s.fecha_esperada asc nulls last, s.created_at asc;

-- Tablas nuevas (DROP TABLE no dispara los triggers de fila: insumos.qty queda intacto).
drop table if exists public.movimientos_stock;
drop function if exists public.aplicar_movimiento_stock();
drop function if exists public.generar_movimientos_stock_factura();
drop table if exists public.insumos_proveedores_okima;

commit;
