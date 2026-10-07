-- Sprint 2 / T3b: RLS por rol (corte de acceso). Reemplaza "acceso_publico" por políticas por rol.
-- ⚠ BASE DE PRODUCCIÓN: un error aquí deja a todos sin acceso o la base abierta. Leer antes de correr.
--
-- Qué hace (una sola transacción; si algo falla, no queda nada a medias):
--   0. Comprobaciones previas (raise exception): rol_actual() y perfiles existen, existen todas las
--      tablas y vistas esperadas y hay AL MENOS UN perfil admin (si no, nadie podría administrar).
--   1. Elimina "acceso_publico" de TODAS las tablas del esquema public (la busca en pg_policies).
--   2. Habilita RLS en TODAS las tablas del esquema public (las que no tengan política quedan en
--      denegación total).
--   3. Crea las políticas por rol (56, separadas por tabla y comando, to authenticated).
--   4. Privilegios: revoca todo a anon (tablas, vistas, secuencias, funciones) y ajusta los de
--      authenticated; service_role no se toca.
--   5. Comprobaciones finales (raise exception): sin acceso_publico, RLS en todas las tablas, todas
--      las políticas creadas, anon sin privilegios.
--
-- Matriz aplicada (S = select, I = insert, U = update, D = delete); p = productor, c = contador, a = admin:
--   categorias                     S:pca I:a   U:a   D:a
--   subcategorias                  S:pca I:a   U:a   D:a
--   proveedores                    S:pca I:ca  U:ca  D:a
--   insumos_proveedores            S:pca I:ca  U:ca  D:a
--   insumos                        S:pca I:pca U:pca D:a
--   insumos_proveedores_okima      S:pca I:pca U:pca D:ca
--   solicitudes_compra             S:pca I:pca U:pca D:a
--   facturas                       S:ca  I:ca  U:ca  D:a (+ contador: solo su cabecera sin líneas ni pagos)
--   detalle_facturas               S:ca  I:ca  U:ca  D:ca
--   movimientos_stock              S:ca  I:a   U:a   D:a
--   plantillas_gastos_recurrentes  S:ca  I:a   U:a   D:a
--   boletas                        S:ca  I:ca  U:ca  D:a (+ contador: solo su cabecera sin líneas ni pagos)
--   detalle_boletas                S:ca  I:ca  U:ca  D:ca
--   pagos                          S:ca  I:ca  U:a   D:a
--   perfiles: perfiles_lectura (select authenticated), sin políticas de escritura (ni siquiera admin).
--   anon: ningún acceso. Sin sesión o sin perfil (rol_actual() null): ningún acceso.
--
-- Notas de diseño:
--   * Las políticas usan (select public.rol_actual()) para que Postgres la evalúe una sola vez por
--     consulta (initplan) y no por fila. rol_actual() es SECURITY DEFINER: no recursa sobre perfiles.
--   * UPDATE necesita política de select (para ver la fila) además de la de update; DELETE necesita
--     select; INSERT ... RETURNING (PostgREST con return=representation) necesita select. Por eso
--     todo rol con I/U/D tiene también S en esa tabla.
--   * Un UPDATE o DELETE denegado por RLS NO da error cuando la fila es visible: afecta 0 filas en
--     silencio (PostgREST responde 2xx sin filas). Solo el INSERT denegado lanza 42501.
--   * Las funciones de trigger son SECURITY DEFINER (stock, created_by, estado, bloqueo de líneas) y
--     corren como su dueño, que salta el RLS: siguen funcionando para cualquier rol. La excepción es
--     marcar_solicitud_comprada(), de invocador: actualiza solicitudes_compra con los permisos de
--     quien edita la línea (contador/admin, ambos con UPDATE sobre solicitudes_compra), así que
--     funciona; no se cambia. Las acciones referenciales (cascade, set null) tampoco pasan por RLS.
--   * Las FK se validan sin RLS: el contador puede referenciar filas que no puede leer.
--   * Idempotente: drop policy if exists + create, y las demás sentencias admiten repetirse.
--
-- Antes de correr: tener sembrados los usuarios y haber comprobado el login (el corte deja sin
-- acceso a quien no tenga perfil). Después: 2026-10-02-11-verificacion.sql y, para probar los roles
-- sin dejar cambios, 2026-10-02-11-pruebas-roles.sql. Reversa de emergencia (vuelve a dejar la base
-- ABIERTA): 2026-10-02-11-rls-por-rol-down.sql.

begin;

-- ---------------------------------------------------------------------------
-- 0. Comprobaciones previas
-- ---------------------------------------------------------------------------
do $$
declare
  v_faltan text;
  v_admins bigint;
begin
  if to_regclass('public.perfiles') is null then
    raise exception 'T3b: no existe public.perfiles; aplica antes 2026-10-02-05-perfiles.sql.';
  end if;
  if to_regprocedure('public.rol_actual()') is null then
    raise exception 'T3b: no existe public.rol_actual(); aplica antes 2026-10-02-05-perfiles.sql.';
  end if;

  select string_agg(t, ', ') into v_faltan
  from unnest(array['categorias', 'subcategorias', 'proveedores', 'insumos_proveedores', 'insumos', 'insumos_proveedores_okima', 'solicitudes_compra', 'facturas', 'detalle_facturas', 'movimientos_stock', 'plantillas_gastos_recurrentes', 'boletas', 'detalle_boletas', 'pagos']) as t
  where to_regclass('public.' || t) is null;
  if v_faltan is not null then
    raise exception 'T3b: faltan tablas de public (¿migraciones 01–10 sin aplicar?): %', v_faltan;
  end if;

  select string_agg(v, ', ') into v_faltan
  from unnest(array['vista_solicitudes_pendientes', 'vista_estado_pago']) as v
  where to_regclass('public.' || v) is null;
  if v_faltan is not null then
    raise exception 'T3b: faltan vistas de public: %', v_faltan;
  end if;

  select count(*) into v_admins from public.perfiles where rol = 'admin';
  if v_admins = 0 then
    raise exception 'T3b: no hay ningún perfil con rol admin; el corte dejaría la base sin administrador. Siembra o corrige perfiles antes.';
  end if;

  raise notice 'T3b: comprobaciones previas OK (% perfil(es) admin).', v_admins;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Eliminar acceso_publico de todas las tablas de public
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname = 'acceso_publico'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    n := n + 1;
  end loop;
  raise notice 'T3b: % política(s) acceso_publico eliminada(s).', n;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. RLS habilitado en todas las tablas de public
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    n := n + 1;
  end loop;
  raise notice 'T3b: RLS habilitado en % tabla(s).', n;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Políticas por rol (perfiles conserva perfiles_lectura)
-- ---------------------------------------------------------------------------
drop policy if exists categorias_select on public.categorias;
drop policy if exists categorias_insert on public.categorias;
drop policy if exists categorias_update on public.categorias;
drop policy if exists categorias_delete on public.categorias;
drop policy if exists subcategorias_select on public.subcategorias;
drop policy if exists subcategorias_insert on public.subcategorias;
drop policy if exists subcategorias_update on public.subcategorias;
drop policy if exists subcategorias_delete on public.subcategorias;
drop policy if exists proveedores_select on public.proveedores;
drop policy if exists proveedores_insert on public.proveedores;
drop policy if exists proveedores_update on public.proveedores;
drop policy if exists proveedores_delete on public.proveedores;
drop policy if exists insumos_proveedores_select on public.insumos_proveedores;
drop policy if exists insumos_proveedores_insert on public.insumos_proveedores;
drop policy if exists insumos_proveedores_update on public.insumos_proveedores;
drop policy if exists insumos_proveedores_delete on public.insumos_proveedores;
drop policy if exists insumos_select on public.insumos;
drop policy if exists insumos_insert on public.insumos;
drop policy if exists insumos_update on public.insumos;
drop policy if exists insumos_delete on public.insumos;
drop policy if exists insumos_proveedores_okima_select on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_insert on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_update on public.insumos_proveedores_okima;
drop policy if exists insumos_proveedores_okima_delete on public.insumos_proveedores_okima;
drop policy if exists solicitudes_compra_select on public.solicitudes_compra;
drop policy if exists solicitudes_compra_insert on public.solicitudes_compra;
drop policy if exists solicitudes_compra_update on public.solicitudes_compra;
drop policy if exists solicitudes_compra_delete on public.solicitudes_compra;
drop policy if exists facturas_select on public.facturas;
drop policy if exists facturas_insert on public.facturas;
drop policy if exists facturas_update on public.facturas;
drop policy if exists facturas_delete on public.facturas;
drop policy if exists detalle_facturas_select on public.detalle_facturas;
drop policy if exists detalle_facturas_insert on public.detalle_facturas;
drop policy if exists detalle_facturas_update on public.detalle_facturas;
drop policy if exists detalle_facturas_delete on public.detalle_facturas;
drop policy if exists movimientos_stock_select on public.movimientos_stock;
drop policy if exists movimientos_stock_insert on public.movimientos_stock;
drop policy if exists movimientos_stock_update on public.movimientos_stock;
drop policy if exists movimientos_stock_delete on public.movimientos_stock;
drop policy if exists plantillas_gastos_recurrentes_select on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_insert on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_update on public.plantillas_gastos_recurrentes;
drop policy if exists plantillas_gastos_recurrentes_delete on public.plantillas_gastos_recurrentes;
drop policy if exists boletas_select on public.boletas;
drop policy if exists boletas_insert on public.boletas;
drop policy if exists boletas_update on public.boletas;
drop policy if exists boletas_delete on public.boletas;
drop policy if exists detalle_boletas_select on public.detalle_boletas;
drop policy if exists detalle_boletas_insert on public.detalle_boletas;
drop policy if exists detalle_boletas_update on public.detalle_boletas;
drop policy if exists detalle_boletas_delete on public.detalle_boletas;
drop policy if exists pagos_select on public.pagos;
drop policy if exists pagos_insert on public.pagos;
drop policy if exists pagos_update on public.pagos;
drop policy if exists pagos_delete on public.pagos;

-- categorias: select → productor, contador, admin
create policy categorias_select on public.categorias
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- categorias: insert → admin
create policy categorias_insert on public.categorias
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin'));

-- categorias: update → admin
create policy categorias_update on public.categorias
  for update to authenticated
  using ((select public.rol_actual()) in ('admin'))
  with check ((select public.rol_actual()) in ('admin'));

-- categorias: delete → admin
create policy categorias_delete on public.categorias
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- subcategorias: select → productor, contador, admin
create policy subcategorias_select on public.subcategorias
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- subcategorias: insert → admin
create policy subcategorias_insert on public.subcategorias
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin'));

-- subcategorias: update → admin
create policy subcategorias_update on public.subcategorias
  for update to authenticated
  using ((select public.rol_actual()) in ('admin'))
  with check ((select public.rol_actual()) in ('admin'));

-- subcategorias: delete → admin
create policy subcategorias_delete on public.subcategorias
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- proveedores: select → productor, contador, admin
create policy proveedores_select on public.proveedores
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- proveedores: insert → contador, admin
create policy proveedores_insert on public.proveedores
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- proveedores: update → contador, admin
create policy proveedores_update on public.proveedores
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- proveedores: delete → admin
create policy proveedores_delete on public.proveedores
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- insumos_proveedores: select → productor, contador, admin
create policy insumos_proveedores_select on public.insumos_proveedores
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos_proveedores: insert → contador, admin
create policy insumos_proveedores_insert on public.insumos_proveedores
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- insumos_proveedores: update → contador, admin
create policy insumos_proveedores_update on public.insumos_proveedores
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- insumos_proveedores: delete → admin
create policy insumos_proveedores_delete on public.insumos_proveedores
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- insumos: select → productor, contador, admin
create policy insumos_select on public.insumos
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos: insert → productor, contador, admin
create policy insumos_insert on public.insumos
  for insert to authenticated
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos: update → productor, contador, admin
create policy insumos_update on public.insumos
  for update to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'))
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos: delete → admin
create policy insumos_delete on public.insumos
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- insumos_proveedores_okima: select → productor, contador, admin
create policy insumos_proveedores_okima_select on public.insumos_proveedores_okima
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos_proveedores_okima: insert → productor, contador, admin
create policy insumos_proveedores_okima_insert on public.insumos_proveedores_okima
  for insert to authenticated
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos_proveedores_okima: update → productor, contador, admin
create policy insumos_proveedores_okima_update on public.insumos_proveedores_okima
  for update to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'))
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- insumos_proveedores_okima: delete → contador, admin
create policy insumos_proveedores_okima_delete on public.insumos_proveedores_okima
  for delete to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- solicitudes_compra: select → productor, contador, admin
create policy solicitudes_compra_select on public.solicitudes_compra
  for select to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- solicitudes_compra: insert → productor, contador, admin
create policy solicitudes_compra_insert on public.solicitudes_compra
  for insert to authenticated
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- solicitudes_compra: update → productor, contador, admin
create policy solicitudes_compra_update on public.solicitudes_compra
  for update to authenticated
  using ((select public.rol_actual()) in ('productor', 'contador', 'admin'))
  with check ((select public.rol_actual()) in ('productor', 'contador', 'admin'));

-- solicitudes_compra: delete → admin
create policy solicitudes_compra_delete on public.solicitudes_compra
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- facturas: select → contador, admin
create policy facturas_select on public.facturas
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- facturas: insert → contador, admin
create policy facturas_insert on public.facturas
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- facturas: update → contador, admin
create policy facturas_update on public.facturas
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- facturas: delete → admin
create policy facturas_delete on public.facturas
  for delete to authenticated
  using (
    (select public.rol_actual()) in ('admin')
    -- El contador solo puede deshacer su propia cabecera recién creada, mientras no tiene líneas ni
    -- pagos (rollback del formulario cuando fallan las líneas); no borra documentos ya armados.
    or ((select public.rol_actual()) = 'contador'
        and created_by = (select auth.uid())
        and not exists (select 1 from public.detalle_facturas d where d.id_factura = facturas.id)
        and not exists (select 1 from public.pagos p where p.id_factura = facturas.id))
  );

-- detalle_facturas: select → contador, admin
create policy detalle_facturas_select on public.detalle_facturas
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_facturas: insert → contador, admin
create policy detalle_facturas_insert on public.detalle_facturas
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_facturas: update → contador, admin
create policy detalle_facturas_update on public.detalle_facturas
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_facturas: delete → contador, admin
create policy detalle_facturas_delete on public.detalle_facturas
  for delete to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- movimientos_stock: select → contador, admin
create policy movimientos_stock_select on public.movimientos_stock
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- movimientos_stock: insert → admin
create policy movimientos_stock_insert on public.movimientos_stock
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin'));

-- movimientos_stock: update → admin
create policy movimientos_stock_update on public.movimientos_stock
  for update to authenticated
  using ((select public.rol_actual()) in ('admin'))
  with check ((select public.rol_actual()) in ('admin'));

-- movimientos_stock: delete → admin
create policy movimientos_stock_delete on public.movimientos_stock
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- plantillas_gastos_recurrentes: select → contador, admin
create policy plantillas_gastos_recurrentes_select on public.plantillas_gastos_recurrentes
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- plantillas_gastos_recurrentes: insert → admin
create policy plantillas_gastos_recurrentes_insert on public.plantillas_gastos_recurrentes
  for insert to authenticated
  with check ((select public.rol_actual()) in ('admin'));

-- plantillas_gastos_recurrentes: update → admin
create policy plantillas_gastos_recurrentes_update on public.plantillas_gastos_recurrentes
  for update to authenticated
  using ((select public.rol_actual()) in ('admin'))
  with check ((select public.rol_actual()) in ('admin'));

-- plantillas_gastos_recurrentes: delete → admin
create policy plantillas_gastos_recurrentes_delete on public.plantillas_gastos_recurrentes
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- boletas: select → contador, admin
create policy boletas_select on public.boletas
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- boletas: insert → contador, admin
create policy boletas_insert on public.boletas
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- boletas: update → contador, admin
create policy boletas_update on public.boletas
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- boletas: delete → admin
create policy boletas_delete on public.boletas
  for delete to authenticated
  using (
    (select public.rol_actual()) in ('admin')
    -- El contador solo puede deshacer su propia cabecera recién creada, mientras no tiene líneas ni
    -- pagos (rollback del formulario cuando fallan las líneas); no borra documentos ya armados.
    or ((select public.rol_actual()) = 'contador'
        and created_by = (select auth.uid())
        and not exists (select 1 from public.detalle_boletas d where d.id_boleta = boletas.id)
        and not exists (select 1 from public.pagos p where p.id_boleta = boletas.id))
  );

-- detalle_boletas: select → contador, admin
create policy detalle_boletas_select on public.detalle_boletas
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_boletas: insert → contador, admin
create policy detalle_boletas_insert on public.detalle_boletas
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_boletas: update → contador, admin
create policy detalle_boletas_update on public.detalle_boletas
  for update to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'))
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- detalle_boletas: delete → contador, admin
create policy detalle_boletas_delete on public.detalle_boletas
  for delete to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- pagos: select → contador, admin
create policy pagos_select on public.pagos
  for select to authenticated
  using ((select public.rol_actual()) in ('contador', 'admin'));

-- pagos: insert → contador, admin
create policy pagos_insert on public.pagos
  for insert to authenticated
  with check ((select public.rol_actual()) in ('contador', 'admin'));

-- pagos: update → admin
create policy pagos_update on public.pagos
  for update to authenticated
  using ((select public.rol_actual()) in ('admin'))
  with check ((select public.rol_actual()) in ('admin'));

-- pagos: delete → admin
create policy pagos_delete on public.pagos
  for delete to authenticated
  using ((select public.rol_actual()) in ('admin'));

-- ---------------------------------------------------------------------------
-- 4. Privilegios
-- ---------------------------------------------------------------------------
-- anon: ningún privilegio sobre tablas, vistas, secuencias ni funciones del esquema public
-- (service_role no se toca). Los default privileges evitan que objetos futuros vuelvan a
-- concedérselos (aplican al rol que ejecuta, normalmente postgres en el SQL Editor).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- authenticated: DML sobre las tablas (el RLS decide qué filas y qué rol); sin TRUNCATE
-- (no pasa por RLS), REFERENCES ni TRIGGER. Las vistas son de solo lectura y perfiles no se
-- escribe desde clientes (se llena con el trigger de auth.users o con service_role).
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.perfiles from authenticated;
revoke insert, update, delete on public.vista_solicitudes_pendientes from authenticated;
revoke insert, update, delete on public.vista_estado_pago from authenticated;
grant execute on function public.rol_actual() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Comprobaciones finales (cualquier fallo revierte todo)
-- ---------------------------------------------------------------------------
do $$
declare
  v_malas text;
  v_presentes integer;
  v_extras text;
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'acceso_publico') then
    raise exception 'T3b: sigue existiendo alguna política acceso_publico.';
  end if;

  select string_agg(c.relname, ', ') into v_malas
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v_malas is not null then
    raise exception 'T3b: tablas de public sin RLS: %', v_malas;
  end if;

  select count(*) into v_presentes
  from pg_policies
  where schemaname = 'public'
    and policyname = any (array['categorias_select', 'categorias_insert', 'categorias_update', 'categorias_delete', 'subcategorias_select', 'subcategorias_insert', 'subcategorias_update', 'subcategorias_delete', 'proveedores_select', 'proveedores_insert', 'proveedores_update', 'proveedores_delete', 'insumos_proveedores_select', 'insumos_proveedores_insert', 'insumos_proveedores_update', 'insumos_proveedores_delete', 'insumos_select', 'insumos_insert', 'insumos_update', 'insumos_delete', 'insumos_proveedores_okima_select', 'insumos_proveedores_okima_insert', 'insumos_proveedores_okima_update', 'insumos_proveedores_okima_delete', 'solicitudes_compra_select', 'solicitudes_compra_insert', 'solicitudes_compra_update', 'solicitudes_compra_delete', 'facturas_select', 'facturas_insert', 'facturas_update', 'facturas_delete', 'detalle_facturas_select', 'detalle_facturas_insert', 'detalle_facturas_update', 'detalle_facturas_delete', 'movimientos_stock_select', 'movimientos_stock_insert', 'movimientos_stock_update', 'movimientos_stock_delete', 'plantillas_gastos_recurrentes_select', 'plantillas_gastos_recurrentes_insert', 'plantillas_gastos_recurrentes_update', 'plantillas_gastos_recurrentes_delete', 'boletas_select', 'boletas_insert', 'boletas_update', 'boletas_delete', 'detalle_boletas_select', 'detalle_boletas_insert', 'detalle_boletas_update', 'detalle_boletas_delete', 'pagos_select', 'pagos_insert', 'pagos_update', 'pagos_delete']);
  if v_presentes <> 56 then
    raise exception 'T3b: se esperaban 56 políticas por rol y hay %.', v_presentes;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfiles' and policyname = 'perfiles_lectura') then
    raise exception 'T3b: falta perfiles_lectura en perfiles.';
  end if;

  select string_agg(c.relname, ', ') into v_malas
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
         or has_any_column_privilege('anon', c.oid, 'select,insert,update,references'));
  if v_malas is not null then
    raise exception 'T3b: anon conserva privilegios sobre: %', v_malas;
  end if;

  if not has_function_privilege('authenticated', 'public.rol_actual()', 'execute') then
    raise exception 'T3b: authenticated no puede ejecutar rol_actual().';
  end if;

  -- Avisos (no abortan): políticas ajenas a esta migración y tablas sin ninguna política.
  select string_agg(tablename || '.' || policyname, ', ') into v_extras
  from pg_policies
  where schemaname = 'public'
    and policyname <> all (array['categorias_select', 'categorias_insert', 'categorias_update', 'categorias_delete', 'subcategorias_select', 'subcategorias_insert', 'subcategorias_update', 'subcategorias_delete', 'proveedores_select', 'proveedores_insert', 'proveedores_update', 'proveedores_delete', 'insumos_proveedores_select', 'insumos_proveedores_insert', 'insumos_proveedores_update', 'insumos_proveedores_delete', 'insumos_select', 'insumos_insert', 'insumos_update', 'insumos_delete', 'insumos_proveedores_okima_select', 'insumos_proveedores_okima_insert', 'insumos_proveedores_okima_update', 'insumos_proveedores_okima_delete', 'solicitudes_compra_select', 'solicitudes_compra_insert', 'solicitudes_compra_update', 'solicitudes_compra_delete', 'facturas_select', 'facturas_insert', 'facturas_update', 'facturas_delete', 'detalle_facturas_select', 'detalle_facturas_insert', 'detalle_facturas_update', 'detalle_facturas_delete', 'movimientos_stock_select', 'movimientos_stock_insert', 'movimientos_stock_update', 'movimientos_stock_delete', 'plantillas_gastos_recurrentes_select', 'plantillas_gastos_recurrentes_insert', 'plantillas_gastos_recurrentes_update', 'plantillas_gastos_recurrentes_delete', 'boletas_select', 'boletas_insert', 'boletas_update', 'boletas_delete', 'detalle_boletas_select', 'detalle_boletas_insert', 'detalle_boletas_update', 'detalle_boletas_delete', 'pagos_select', 'pagos_insert', 'pagos_update', 'pagos_delete', 'perfiles_lectura']);
  if v_extras is not null then
    raise notice 'T3b: políticas adicionales no gestionadas por esta migración: %', v_extras;
  end if;

  select string_agg(c.relname, ', ') into v_extras
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind in ('r', 'p')
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
  if v_extras is not null then
    raise notice 'T3b: tablas con RLS y SIN políticas (denegación total): %', v_extras;
  end if;

  raise notice 'T3b: comprobaciones finales OK.';
end
$$;

commit;
