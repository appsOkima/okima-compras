-- Verificación posterior a 2026-10-02-10-pagos.sql.
-- SOLO LECTURA: no modifica nada. Ejecutar en el SQL Editor y revisar cada bloque
-- (el editor muestra solo el último resultado: correr los bloques de a uno).

-- 1. Estructura: 8 columnas. monto, fecha_pago y created_at NOT NULL; id_factura, id_boleta,
--    notas y created_by nullable.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'pagos'
order by ordinal_position;

-- 2. Constraints: CHECK monto > 0, CHECK num_nonnulls = 1, FK a facturas/boletas con
--    "ON DELETE NO ACTION" (sin cascade) y FK a perfiles con "ON DELETE SET NULL".
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'public.pagos'::regclass
order by contype, conname;

-- 3. Índices: pagos_fecha_pago_idx, pagos_id_factura_idx, pagos_id_boleta_idx (y la PK).
select indexname from pg_indexes where schemaname = 'public' and tablename = 'pagos' order by 1;

-- 4. Trigger asignar_created_by (BEFORE INSERT) y RLS con acceso_publico (1 fila cada uno).
select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public' and event_object_table = 'pagos';

select tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'pagos';
select relrowsecurity from pg_class where oid = 'public.pagos'::regclass;  -- true

-- 5. Σ pagos históricos = Σ totales (las dos diferencias deben ser 0 justo tras migrar; después
--    de ingresar documentos o pagos nuevos pueden dejar de cuadrar, y es normal).
select
  (select coalesce(sum(total), 0) from facturas where total > 0)
  - (select coalesce(sum(monto), 0) from pagos
       where id_factura is not null and notas = 'Migración histórica: pago al contado') as dif_facturas,
  (select coalesce(sum(monto), 0) from boletas where monto > 0)
  - (select coalesce(sum(monto), 0) from pagos
       where id_boleta is not null and notas = 'Migración histórica: pago al contado')  as dif_boletas;

-- 6. Documentos sin pago. Esperado justo tras migrar: solo los de total/monto <= 0 (avisados al migrar).
select 'factura' as tipo, f.id, f.numero_factura as referencia, f.total as monto, f.estado_documento::text as estado
from facturas f where not exists (select 1 from pagos p where p.id_factura = f.id)
union all
select 'boleta', b.id, b.concepto, b.monto, b.estado_documento::text
from boletas b where not exists (select 1 from pagos p where p.id_boleta = b.id)
order by 1, 4;

-- 7. Conteos: pagos por tipo, y de ellos históricos. Esperado tras migrar: pagos de facturas = facturas
--    con total > 0; pagos de boletas = boletas con monto > 0.
select
  (select count(*) from pagos where id_factura is not null) as pagos_facturas,
  (select count(*) from facturas where total > 0)           as facturas_con_total,
  (select count(*) from pagos where id_boleta is not null)  as pagos_boletas,
  (select count(*) from boletas where monto > 0)            as boletas_con_monto,
  (select count(*) from pagos where notas = 'Migración histórica: pago al contado') as historicos;

-- 8. Pagos inconsistentes (debe ser 0 en todas): sin documento único, con monto <= 0 y
--    pagos históricos con fecha distinta a la del documento.
select
  (select count(*) from pagos where num_nonnulls(id_factura, id_boleta) <> 1) as sin_documento_unico,
  (select count(*) from pagos where monto <= 0)                               as montos_invalidos,
  (select count(*) from pagos p join facturas f on f.id = p.id_factura
     where p.notas = 'Migración histórica: pago al contado' and p.fecha_pago <> f.fecha)
  + (select count(*) from pagos p join boletas b on b.id = p.id_boleta
     where p.notas = 'Migración histórica: pago al contado' and p.fecha_pago <> b.fecha)
                                                                               as historicos_con_fecha_distinta;

-- 9. Vista: una fila por documento (filas = facturas + boletas; la diferencia debe ser 0),
--    security_invoker activo (reloptions contiene security_invoker=true).
select
  (select count(*) from vista_estado_pago)
  - (select count(*) from facturas) - (select count(*) from boletas) as dif_filas;

select reloptions from pg_class where oid = 'public.vista_estado_pago'::regclass;

-- 10. Distribución por estado de pago. Recién migrado: 'pagado' (vigentes con total > 0 y los de total 0),
--     'anulado' (los anulados) y ningún 'pendiente' ni 'parcial', salvo documentos sin pago de total > 0.
select tipo, estado_pago, count(*) as documentos, coalesce(sum(total), 0) as total, coalesce(sum(saldo), 0) as saldo
from vista_estado_pago
group by 1, 2
order by 1, 2;

-- 11. Sobrepagos (saldo negativo; informativo, vacío si no hay) y pagos de documentos anulados (informativo).
select tipo, id_documento, total, pagado, saldo
from vista_estado_pago where saldo < 0 and estado_pago <> 'anulado';

select tipo, id_documento, total, pagado
from vista_estado_pago where estado_pago = 'anulado' and pagado > 0;
