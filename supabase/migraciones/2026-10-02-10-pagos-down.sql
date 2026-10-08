-- Reversa de 2026-10-02-10-pagos.sql. Una sola transacción.
-- ⚠ DESTRUCTIVA: elimina la vista vista_estado_pago y la tabla `pagos` completa.
--   * Se pierden TODOS los pagos, incluidos los ingresados a mano después de migrar (cuotas,
--     pagos parciales): esos no se pueden reconstruir desde las facturas/boletas. Respaldar antes:
--       select * from pagos order by fecha_pago;
--   * Los pagos de la migración histórica sí se pueden recrear volviendo a aplicar la migración
--     (crea un pago por documento con fecha del documento), pero ya sin cuotas manuales.
--   * Un raise notice informa cuántos pagos se pierden y cuántos eran migración histórica
--     (notas = 'Migración histórica: pago al contado') frente a ingresados después.
-- No toca facturas, boletas ni sus líneas. El Resumen (T7b) debe volver a sumar
-- facturas.total / boletas.monto antes de revertir, o quedará sin datos.

begin;

do $$
declare
  v_marca constant text := 'Migración histórica: pago al contado';
  v_total bigint;
  v_hist bigint;
  v_monto numeric;
begin
  if to_regclass('public.pagos') is null then
    raise exception 'Reversa T7a: la tabla pagos no existe; la migración no está aplicada.';
  end if;

  select count(*), count(*) filter (where notas = v_marca), coalesce(sum(monto), 0)
  into v_total, v_hist, v_monto
  from public.pagos;

  raise notice 'Reversa T7a: se eliminan % pagos (monto total %): % de migración histórica y % ingresados después (estos últimos se pierden sin reconstrucción posible).',
    v_total, v_monto, v_hist, v_total - v_hist;
end
$$;

drop view if exists public.vista_estado_pago;
drop table if exists public.pagos;  -- arrastra sus índices, trigger, política y constraints

commit;
