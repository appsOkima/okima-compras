-- Reversa de 2026-10-19-14-insumos-proveedores-se-vincula.sql. Una sola transacción.
-- Elimina la columna: se pierde qué insumos estaban descartados (vuelven a aparecer en
-- Por vincular). Desplegar antes el frontend anterior: el actual selecciona se_vincula.
-- Idempotente.

begin;

alter table public.insumos_proveedores drop column if exists se_vincula;

commit;
