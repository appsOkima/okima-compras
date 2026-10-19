-- Migración 14: insumos_proveedores.se_vincula (Sprint 3 / T5).
-- Algunos insumos del proveedor nunca se vincularán con un insumo Okima (p. ej. no se
-- controlan en stock). El administrador los "descarta" en Por vincular (se_vincula = false):
-- salen de esa lista, la factura no propone vincularlos y se ven en "Sin vínculo".
-- Aditiva e idempotente: filas existentes quedan en true. Sin cambios de RLS (las políticas
-- de insumos_proveedores son por tabla, no por columna) ni de vistas. No toca la pivote.

begin;

alter table public.insumos_proveedores
  add column if not exists se_vincula boolean not null default true;

comment on column public.insumos_proveedores.se_vincula is
  'false = descartado: nunca se vinculará a un insumo Okima (sale de Por vincular, la factura no propone vincular). Reversible.';

commit;
