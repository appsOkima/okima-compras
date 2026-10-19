-- Verificación posterior a 2026-10-19-14-insumos-proveedores-se-vincula.sql.
-- SOLO LECTURA. Un único SELECT: una fila con `ok` = true si la columna es boolean NOT NULL
-- default true y no quedó ninguna fila con valor nulo; `descartados` es informativo.

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'insumos_proveedores'
      and column_name = 'se_vincula' and data_type = 'boolean'
      and is_nullable = 'NO' and column_default = 'true'
  ) as ok,
  (select count(*) from public.insumos_proveedores where not se_vincula) as descartados;
