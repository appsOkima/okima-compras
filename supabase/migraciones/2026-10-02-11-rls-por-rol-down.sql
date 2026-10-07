-- Reversa de 2026-10-02-11-rls-por-rol.sql. Una sola transacción.
-- ⚠ REVERSA DE EMERGENCIA: deja la base ABIERTA otra vez (acceso_publico para anon y authenticated
--   en todas las tablas, y los privilegios de anon restituidos). Usar solo si el corte dejó a todos
--   sin acceso; después, corregir y volver a aplicar la migración.
--   * Elimina las 56 políticas por rol (por nombre).
--   * Recrea "acceso_publico" (for all, using true, with check true) en las 14 tablas que la tenían
--     (perfiles no la tenía: conserva perfiles_lectura).
--   * Restituye los privilegios por defecto de Supabase: anon y authenticated con todo sobre las
--     tablas y vistas, secuencias y funciones de public (y los default privileges de anon).
--   * El RLS queda habilitado (como antes de la migración).

begin;

do $$
begin
  raise notice 'Reversa T3b: se restaura el acceso PÚBLICO (anon incluido) a todas las tablas.';
end
$$;

drop policy if exists categorias_select on public.categorias;
drop policy if exists categorias_insert on public.categorias;
drop policy if exists categorias_update on public.categorias;
drop policy if exists categorias_delete on public.categorias;
drop policy if exists subcategorias_select on public.subcategorias;
drop policy if exists subcategorias_insert on public.subcategorias;
drop policy if exists subcategorias_update on public.subcategorias;
drop policy if exists subcategorias_delete on public.subcategorias;
drop policy if exists proveedores_select on public.proveedores;
drop policy if exists proveedores_insert on public.proveedores;
drop policy if exists proveedores_update on public.proveedores;
drop policy if exists proveedores_delete on public.proveedores;
drop policy if exists insumos_proveedores_select on public.insumos_proveedores;
drop policy if exists insumos_proveedores_insert on public.insumos_proveedores;
drop policy if exists insumos_proveedores_update on public.insumos_proveedores;
drop policy if exists insumos_proveedores_delete on public.insumos_proveedores;
drop policy if exists insumos_select on public.insumos;
drop policy if exists insumos_insert on public.insumos;
drop policy if exists insumos_update on public.insumos;
drop policy if exists insumos_delete on public.insumos;
drop policy if exists insumos_proveedores_okima_select on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_insert on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_update on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_delete on public.insumos_proveedores_okima;
drop policy if exists solicitudes_compra_select on public.solicitudes_compra;
drop policy if exists solicitudes_compra_insert on public.solicitudes_compra;
drop policy if exists solicitudes_compra_update on public.solicitudes_compra;
drop policy if exists solicitudes_compra_delete on public.solicitudes_compra;
drop policy if exists facturas_select on public.facturas;
drop policy if exists facturas_insert on public.facturas;
drop policy if exists facturas_update on public.facturas;
drop policy if exists facturas_delete on public.facturas;
drop policy if exists detalle_facturas_select on public.detalle_facturas;
drop policy if exists detalle_facturas_insert on public.detalle_facturas;
drop policy if exists detalle_facturas_update on public.detalle_facturas;
drop policy if exists detalle_facturas_delete on public.detalle_facturas;
drop policy if exists movimientos_stock_select on public.movimientos_stock;
drop policy if exists movimientos_stock_insert on public.movimientos_stock;
drop policy if exists movimientos_stock_update on public.movimientos_stock;
drop policy if exists movimientos_stock_delete on public.movimientos_stock;
drop policy if exists plantillas_gastos_recurrentes_select on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_insert on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_update on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_delete on public.plantillas_gastos_recurrentes;
drop policy if exists boletas_select on public.boletas;
drop policy if exists boletas_insert on public.boletas;
drop policy if exists boletas_update on public.boletas;
drop policy if exists boletas_delete on public.boletas;
drop policy if exists detalle_boletas_select on public.detalle_boletas;
drop policy if exists detalle_boletas_insert on public.detalle_boletas;
drop policy if exists detalle_boletas_update on public.detalle_boletas;
drop policy if exists detalle_boletas_delete on public.detalle_boletas;
drop policy if exists pagos_select on public.pagos;
drop policy if exists pagos_insert on public.pagos;
drop policy if exists pagos_update on public.pagos;
drop policy if exists pagos_delete on public.pagos;

do $$
declare
  t text;
begin
  foreach t in array array['categorias', 'subcategorias', 'proveedores', 'insumos', 'insumos_proveedores', 'insumos_proveedores_okima', 'solicitudes_compra', 'facturas', 'detalle_facturas', 'movimientos_stock', 'plantillas_gastos_recurrentes', 'boletas', 'detalle_boletas', 'pagos']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "acceso_publico" on public.%I', t);
      execute format(
        'create policy "acceso_publico" on public.%I for all to anon, authenticated using (true) with check (true)',
        t
      );
    end if;
  end loop;
end
$$;

grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon;
alter default privileges in schema public grant all on sequences to anon;
alter default privileges in schema public grant execute on functions to anon;

commit;
