-- Reversa de 2026-10-02-12-vinculo-solicitud-boletas.sql. Una sola transacción.
--   * Elimina los triggers de exclusividad (facturas y boletas), el trigger 'Comprada' de
--     detalle_boletas y la función validar_exclusividad_solicitud().
--   * Elimina detalle_boletas.id_solicitud_compra (con su índice y su FK).
--   * NO toca marcar_solicitud_comprada() (la sigue usando detalle_facturas) ni el trigger de
--     detalle_facturas.
-- ⚠ Se PIERDEN los vínculos línea de boleta -> solicitud (avisa con raise notice cuántos).
-- ⚠ Las solicitudes que esos vínculos marcaron como 'Comprada' NO se revierten: quedan en
--   'Comprada' sin ninguna línea que las respalde; corregirlas a mano si procede.
-- Los comentarios de columna de id_solicitud_compra de detalle_facturas se restauran a null.

begin;

do $$
declare
  v_lineas bigint;
  v_solicitudes bigint;
  v_comprada bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'detalle_boletas' and column_name = 'id_solicitud_compra'
  ) then
    raise exception 'Reversa T8a: detalle_boletas.id_solicitud_compra no existe; la migración no está aplicada.';
  end if;

  select count(*), count(distinct id_solicitud_compra) into v_lineas, v_solicitudes
  from public.detalle_boletas where id_solicitud_compra is not null;

  select count(*) into v_comprada
  from public.solicitudes_compra s
  where s.estado = 'Comprada'
    and exists (select 1 from public.detalle_boletas d where d.id_solicitud_compra = s.id)
    and not exists (select 1 from public.detalle_facturas f where f.id_solicitud_compra = s.id);

  raise notice 'Reversa T8a: % líneas de boleta tienen solicitud (% solicitudes distintas); esos vínculos se pierden.', v_lineas, v_solicitudes;
  raise notice 'Reversa T8a: % solicitudes quedarán ''Comprada'' sin línea que las respalde (no se revierten).', v_comprada;
end
$$;

drop trigger if exists detalle_facturas_validar_exclusividad_solicitud on public.detalle_facturas;
drop trigger if exists detalle_boletas_validar_exclusividad_solicitud on public.detalle_boletas;
drop trigger if exists detalle_boletas_marcar_solicitud_comprada on public.detalle_boletas;
drop function if exists public.validar_exclusividad_solicitud();

comment on column public.detalle_facturas.id_solicitud_compra is null;

drop index if exists public.detalle_boletas_id_solicitud_compra_idx;
alter table public.detalle_boletas drop column if exists id_solicitud_compra;

commit;
