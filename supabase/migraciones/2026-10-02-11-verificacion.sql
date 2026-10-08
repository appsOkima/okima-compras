-- Verificación posterior a 2026-10-02-11-rls-por-rol.sql.
-- SOLO LECTURA: no modifica nada. Un único SELECT con todo en un solo resultado
-- (columnas: seccion, objeto, valor, ok). ok = false marca algo que revisar.

with tablas as (
  select c.oid, c.relname, c.relrowsecurity, c.relkind
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind in ('r', 'p')
),
vistas as (
  select c.oid, c.relname
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind in ('v', 'm')
)
-- 1. Tablas de public sin RLS (esperado: ninguna).
select '1. tabla sin RLS' as seccion, relname::text as objeto, 'relrowsecurity = false' as valor, false as ok
from tablas where not relrowsecurity
union all
select '1. tablas sin RLS (total)', '', count(*) filter (where not relrowsecurity)::text, count(*) filter (where not relrowsecurity) = 0
from tablas
union all
-- 2. Políticas acceso_publico restantes (esperado: 0).
select '2. acceso_publico restante', tablename::text, policyname::text, false
from pg_policies where schemaname = 'public' and policyname = 'acceso_publico'
union all
select '2. acceso_publico restantes (total)', '', count(*)::text, count(*) = 0
from pg_policies where schemaname = 'public' and policyname = 'acceso_publico'
union all
-- 3. Políticas por tabla (esperado: 4 por tabla de negocio —select, insert, update, delete— y 1 en perfiles).
select '3. políticas por tabla', t.relname::text,
       count(p.policyname)::text || ' (' || coalesce(string_agg(p.cmd, ',' order by p.cmd), 'ninguna') || ')',
       case when t.relname = 'perfiles' then count(p.policyname) = 1 else count(p.policyname) = 4 end
from tablas t
left join pg_policies p on p.schemaname = 'public' and p.tablename = t.relname
group by t.relname
union all
-- 4. Privilegios de anon (esperado: ninguno) sobre tablas y vistas.
select '4. anon con privilegios', x.relname::text, 'tiene algún privilegio', false
from (
  select oid, relname from tablas
  union all
  select oid, relname from vistas
) x
where has_table_privilege('anon', x.oid, 'select,insert,update,delete,truncate,references,trigger')
   or has_any_column_privilege('anon', x.oid, 'select,insert,update,references')
union all
select '4. anon con privilegios (total)', '',
       (select count(*) from (select oid from tablas union all select oid from vistas) x
        where has_table_privilege('anon', x.oid, 'select,insert,update,delete,truncate,references,trigger')
           or has_any_column_privilege('anon', x.oid, 'select,insert,update,references'))::text,
       (select count(*) from (select oid from tablas union all select oid from vistas) x
        where has_table_privilege('anon', x.oid, 'select,insert,update,delete,truncate,references,trigger')
           or has_any_column_privilege('anon', x.oid, 'select,insert,update,references')) = 0
union all
select '4. anon puede ejecutar rol_actual()', '', has_function_privilege('anon', 'public.rol_actual()', 'execute')::text,
       not has_function_privilege('anon', 'public.rol_actual()', 'execute')
union all
-- 5. authenticated: select en vistas, sin escritura en vistas ni perfiles.
select '5. authenticated lee vistas', v.relname::text, has_table_privilege('authenticated', v.oid, 'select')::text,
       has_table_privilege('authenticated', v.oid, 'select') and not has_table_privilege('authenticated', v.oid, 'insert,update,delete')
from vistas v
union all
select '5. authenticated sin escritura en perfiles', 'perfiles', has_table_privilege('authenticated', 'public.perfiles', 'insert,update,delete')::text,
       not has_table_privilege('authenticated', 'public.perfiles', 'insert,update,delete')
union all
select '5. authenticated ejecuta rol_actual()', '', has_function_privilege('authenticated', 'public.rol_actual()', 'execute')::text,
       has_function_privilege('authenticated', 'public.rol_actual()', 'execute')
union all
-- 6. Al menos un admin con perfil.
select '6. perfiles admin', '', count(*)::text, count(*) >= 1
from public.perfiles where rol = 'admin'
order by 1, 2;
