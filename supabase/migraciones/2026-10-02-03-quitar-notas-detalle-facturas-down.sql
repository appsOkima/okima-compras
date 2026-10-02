-- Reversa de 2026-10-02-03-quitar-notas-detalle-facturas.sql (vuelve a agregar la
-- columna, vacía).

begin;

alter table detalle_facturas add column if not exists notas text;

commit;
