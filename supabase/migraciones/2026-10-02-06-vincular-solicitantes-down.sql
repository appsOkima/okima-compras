-- Reversa de 2026-10-02-06-vincular-solicitantes.sql: vacía id_solicitante.
begin;
update public.solicitudes_compra set id_solicitante = null;
commit;
