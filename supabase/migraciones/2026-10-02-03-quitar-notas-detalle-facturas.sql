-- Sprint 2 / T2 (ajuste): las líneas de factura no llevan `notas`.
-- Quita la columna agregada por 2026-10-02-02-notas-universal.sql. Si esa migración
-- se aplicó, BORRA el contenido de esas notas; si no, no hace nada. Idempotente.
-- Reversa: 2026-10-02-03-quitar-notas-detalle-facturas-down.sql.

begin;

alter table detalle_facturas drop column if exists notas;

commit;
