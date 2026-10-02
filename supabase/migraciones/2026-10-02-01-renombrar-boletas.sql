-- Sprint 2 / T1: "Otros Gastos" pasa a "Boletas".
-- Renombra la tabla otros_gastos a boletas, junto con su PK, FKs, índices y
-- comentarios, para que coincidan con el nombre nuevo. Conserva datos y FKs.
-- La columna id_plantilla_recurrente se mantiene (sigue apuntando a
-- plantillas_gastos_recurrentes: las plantillas conservan su nombre).
-- Idempotente: si ya se aplicó (o la tabla no existe) no hace nada.
-- La política "acceso_publico" no lleva el nombre de la tabla; no se toca.
-- Reversa: 2026-10-02-01-renombrar-boletas-down.sql.

begin;

do $$
begin
  if to_regclass('public.otros_gastos') is not null and to_regclass('public.boletas') is null then
    alter table otros_gastos rename to boletas;
  end if;
end
$$;

-- Constraints (PK y FKs con nombre autogenerado) e índices.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'otros_gastos_pkey') then
    alter table boletas rename constraint otros_gastos_pkey to boletas_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'otros_gastos_id_subcategoria_fkey') then
    alter table boletas rename constraint otros_gastos_id_subcategoria_fkey to boletas_id_subcategoria_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'otros_gastos_id_plantilla_recurrente_fkey') then
    alter table boletas rename constraint otros_gastos_id_plantilla_recurrente_fkey to boletas_id_plantilla_recurrente_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'otros_gastos_id_proveedor_fkey') then
    alter table boletas rename constraint otros_gastos_id_proveedor_fkey to boletas_id_proveedor_fkey;
  end if;
end
$$;

alter index if exists otros_gastos_id_subcategoria_idx rename to boletas_id_subcategoria_idx;
alter index if exists otros_gastos_id_plantilla_recurrente_idx rename to boletas_id_plantilla_recurrente_idx;
alter index if exists otros_gastos_id_proveedor_idx rename to boletas_id_proveedor_idx;
alter index if exists otros_gastos_fecha_idx rename to boletas_fecha_idx;

comment on table boletas is
  'Boletas: gastos que no son compra de un insumo con stock (arriendo, sueldos, pago de IVA, servicios). Antes otros_gastos.';

commit;
