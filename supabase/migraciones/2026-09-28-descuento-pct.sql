-- =============================================================================
-- Migración 2026-09-28: descuentos de facturas pasan de monto a porcentaje.
--
-- Ejecutar una sola vez en el SQL Editor de Supabase, sobre la base creada con
-- el schema.sql anterior. (Una instalación nueva ya lo trae en schema.sql.)
--
--   detalle_facturas.descuento  → descuento_pct (0–100)
--   facturas.descuento_total    → descuento_pct (0–100)
--
-- Si ya hay descuentos distintos de 0 (guardados como monto), se detiene sin
-- cambiar nada: un monto no se puede reinterpretar como porcentaje en silencio.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from detalle_facturas where descuento <> 0)
     or exists (select 1 from facturas where descuento_total <> 0) then
    raise exception 'Hay facturas o líneas con descuento (en monto) distinto de 0. Revísalas o déjalas en 0 antes de migrar.';
  end if;
end
$$;

alter table detalle_facturas rename column descuento to descuento_pct;
alter table detalle_facturas
  add constraint detalle_facturas_descuento_pct_check check (descuento_pct between 0 and 100);

alter table facturas rename column descuento_total to descuento_pct;
alter table facturas
  add constraint facturas_descuento_pct_check check (descuento_pct between 0 and 100);

commit;
