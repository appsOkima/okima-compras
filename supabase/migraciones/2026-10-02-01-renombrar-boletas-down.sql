-- Reversa de 2026-10-02-01-renombrar-boletas.sql: boletas vuelve a otros_gastos.
-- Idempotente. Solo es válida mientras no existan objetos posteriores del Sprint 2
-- que dependan del nombre boletas (detalle_boletas, etc.): revertir esos primero.

begin;

comment on table boletas is null;

do $$
begin
  if to_regclass('public.boletas') is not null and to_regclass('public.otros_gastos') is null then
    alter table boletas rename to otros_gastos;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'boletas_pkey') then
    alter table otros_gastos rename constraint boletas_pkey to otros_gastos_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'boletas_id_subcategoria_fkey') then
    alter table otros_gastos rename constraint boletas_id_subcategoria_fkey to otros_gastos_id_subcategoria_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'boletas_id_plantilla_recurrente_fkey') then
    alter table otros_gastos rename constraint boletas_id_plantilla_recurrente_fkey to otros_gastos_id_plantilla_recurrente_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'boletas_id_proveedor_fkey') then
    alter table otros_gastos rename constraint boletas_id_proveedor_fkey to otros_gastos_id_proveedor_fkey;
  end if;
end
$$;

alter index if exists boletas_id_subcategoria_idx rename to otros_gastos_id_subcategoria_idx;
alter index if exists boletas_id_plantilla_recurrente_idx rename to otros_gastos_id_plantilla_recurrente_idx;
alter index if exists boletas_id_proveedor_idx rename to otros_gastos_id_proveedor_idx;
alter index if exists boletas_fecha_idx rename to otros_gastos_fecha_idx;

commit;
