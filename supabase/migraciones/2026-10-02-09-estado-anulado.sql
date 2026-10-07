-- Sprint 2 / T6a: estado "Anulado" en facturas y boletas (solo base de datos).
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas: `raise exception` ANTES de tocar nada si faltan las migraciones
--      01-08 (perfiles, rol_actual(), movimientos_stock con id_detalle_boleta, etc.) o las
--      funciones auth.uid() / auth.role() de Supabase. Guarda la suma de insumos.qty para
--      comprobar al final que la migración NO movió stock. Bloquea escrituras mientras dura.
--   2. Enum estado_documento ('vigente','anulado') y, en facturas y boletas:
--      estado_documento (not null, default 'vigente': todo lo existente queda vigente),
--      anulado_por (FK a perfiles, on delete set null), anulado_at, motivo_anulacion
--      (opcional en la base; la interfaz lo pedirá). Índices PARCIALES sobre los anulados
--      (pocos): el Resumen filtra por 'vigente', que es casi todo, y un índice completo no
--      ayudaría.
--   3. movimientos_stock.revertido (boolean not null default false) y reescritura de
--      aplicar_movimiento_stock() + su trigger (ahora también dispara en `update of revertido`):
--        INSERT  suma solo si no está revertido.
--        DELETE  resta solo si no está revertido (borrar en cascada un documento anulado NO
--                resta dos veces: sus movimientos ya estaban revertidos).
--        UPDATE  resta old.qty si old no estaba revertido y suma new.qty si new no está
--                revertido (cubre false->true, true->false y cambios de qty/insumo).
--      Sigue SECURITY DEFINER con search_path fijo.
--   4. Triggers de documento (funciones generales, una por responsabilidad, para facturas y boletas):
--        validar_estado_documento() BEFORE UPDATE:
--          * anulado -> anulado: cualquier cambio en otros campos lanza excepción (se tolera
--            solo que created_by / anulado_por pasen a null por el `on delete set null` de
--            perfiles, para no impedir borrar un usuario).
--          * vigente -> anulado: exige contador o admin, fija anulado_at = now() y
--            anulado_por = auth.uid() (null si ese usuario no tiene perfil).
--          * anulado -> vigente (reactivar): exige admin y limpia anulado_por / anulado_at /
--            motivo_anulacion.
--          * vigente -> vigente: los campos de anulación se fuerzan a null (no se pueden
--            escribir a mano en un documento vigente).
--          El rol se exige cuando hay sesión (auth.uid() no nulo) o cuando la petición llega
--          con el rol `anon` de PostgREST. Sin sesión de usuario y sin ser `anon` (SQL Editor,
--          service role) las transiciones se permiten sin chequear rol. (Ajuste sobre el
--          diseño: tratar `anon` como "con sesión" evita que una petición anónima se salte la
--          comprobación mientras el RLS siga permisivo.)
--        sincronizar_stock_estado_documento() AFTER UPDATE (solo si cambia el estado):
--          anular -> marca revertido = true en los movimientos de TODAS las líneas del
--          documento (revierte el stock exacto, conserva el registro); reactivar -> los pone
--          en false (reaplica exactamente lo revertido, sin recalcular con la pivote actual).
--   5. bloquear_lineas_documento_anulado() BEFORE INSERT OR UPDATE en detalle_facturas y
--      detalle_boletas: no admite insertar ni modificar líneas de un documento anulado
--      (tampoco moverlas desde o hacia uno). Toma `for share` sobre el documento para que una
--      anulación concurrente espere a la línea en curso (o viceversa). El DELETE queda
--      permitido (incluido el borrado en cascada del documento por el Admin). Excepción: el
--      `on delete set null` de detalle_facturas.id_solicitud_compra (borrar una solicitud
--      vinculada a una línea anulada) se reconoce por pg_trigger_depth() > 1 y se permite.
--      No bloquea a generar_movimientos_stock_factura/boleta: son triggers AFTER de las líneas
--      y, como las líneas de un documento anulado no se pueden insertar ni actualizar, nunca
--      se disparan sobre ellas.
-- NO se cambia UNIQUE (id_proveedor, numero_factura): una factura anulada sigue ocupando su
-- número (decisión pendiente del usuario). NO se tocan vistas ni pagos (T7). Las solicitudes
-- mantienen 'Cancelada' en la base.
-- Idempotente: si ya se aplicó, vuelve a dejar el mismo estado sin duplicar nada.
-- Comprobación posterior: 2026-10-02-09-verificacion.sql.
-- Reversa: 2026-10-02-09-estado-anulado-down.sql.

begin;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
begin
  if to_regclass('public.facturas') is null
     or to_regclass('public.boletas') is null
     or to_regclass('public.detalle_facturas') is null
     or to_regclass('public.detalle_boletas') is null
     or to_regclass('public.movimientos_stock') is null
     or to_regclass('public.insumos') is null
     or to_regclass('public.perfiles') is null then
    raise exception 'T6a: faltan tablas (facturas, boletas, detalle_facturas, detalle_boletas, movimientos_stock, insumos, perfiles). Aplicar antes las migraciones 01-08.';
  end if;

  if to_regprocedure('public.rol_actual()') is null then
    raise exception 'T6a: falta public.rol_actual() (migración 05).';
  end if;
  if to_regprocedure('public.aplicar_movimiento_stock()') is null then
    raise exception 'T6a: falta aplicar_movimiento_stock() (migración 07).';
  end if;
  if to_regprocedure('auth.uid()') is null or to_regprocedure('auth.role()') is null then
    raise exception 'T6a: faltan auth.uid() / auth.role() (esquema auth de Supabase).';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'movimientos_stock' and column_name = 'id_detalle_boleta'
  ) then
    raise exception 'T6a: movimientos_stock no tiene id_detalle_boleta (migración 08 sin aplicar).';
  end if;

  -- Si el enum ya existe debe tener exactamente las etiquetas esperadas.
  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'estado_documento')
     and (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
          where enumtypid = 'public.estado_documento'::regtype) is distinct from array['vigente', 'anulado'] then
    raise exception 'T6a: el tipo estado_documento ya existe con etiquetas distintas de (vigente, anulado).';
  end if;
end
$$;

lock table public.facturas, public.boletas, public.detalle_facturas, public.detalle_boletas,
           public.movimientos_stock, public.insumos
  in share row exclusive mode;

-- Foto del stock total para comprobar al final que la migración no lo movió
-- (variable local a la transacción).
select set_config('okima.t6a_stock', coalesce(sum(qty), 0)::text, true) from public.insumos;
-- ¿Ya estaba aplicada? (en una re-ejecución puede haber documentos anulados legítimos)
select set_config('okima.t6a_reaplicada', (exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'facturas' and column_name = 'estado_documento'
))::text, true);

-- 2. Enum y columnas de estado ----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'estado_documento') then
    create type public.estado_documento as enum ('vigente', 'anulado');
  end if;
end
$$;

alter table public.facturas
  add column if not exists estado_documento public.estado_documento not null default 'vigente',
  add column if not exists anulado_por uuid references public.perfiles (id) on delete set null,
  add column if not exists anulado_at timestamptz,
  add column if not exists motivo_anulacion text;

alter table public.boletas
  add column if not exists estado_documento public.estado_documento not null default 'vigente',
  add column if not exists anulado_por uuid references public.perfiles (id) on delete set null,
  add column if not exists anulado_at timestamptz,
  add column if not exists motivo_anulacion text;

create index if not exists facturas_anuladas_idx
  on public.facturas (anulado_at) where estado_documento = 'anulado';
create index if not exists boletas_anuladas_idx
  on public.boletas (anulado_at) where estado_documento = 'anulado';

comment on column public.facturas.estado_documento is
  'vigente | anulado. Anular revierte el stock (movimientos_stock.revertido) y excluye el documento de totales; solo contador/admin anula, solo admin reactiva.';
comment on column public.boletas.estado_documento is
  'vigente | anulado. Anular revierte el stock (movimientos_stock.revertido) y excluye el documento de totales; solo contador/admin anula, solo admin reactiva.';
comment on column public.facturas.motivo_anulacion is 'Opcional en la base; la interfaz lo pide al anular.';
comment on column public.boletas.motivo_anulacion is 'Opcional en la base; la interfaz lo pide al anular.';

-- 3. Stock revertible --------------------------------------------------------------
alter table public.movimientos_stock
  add column if not exists revertido boolean not null default false;

comment on column public.movimientos_stock.revertido is
  'true = movimiento revertido por la anulación de su documento: se conserva el registro pero ya no cuenta en insumos.qty. Reactivar el documento lo vuelve a false (reaplica exactamente qty).';

create or replace function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not new.revertido then
      update insumos set qty = qty + new.qty where id = new.id_insumo;
    end if;
  elsif tg_op = 'DELETE' then
    if not old.revertido then
      update insumos set qty = qty - old.qty where id = old.id_insumo;
    end if;
  else
    if new.qty is distinct from old.qty
       or new.id_insumo is distinct from old.id_insumo
       or new.revertido is distinct from old.revertido then
      if not old.revertido then
        update insumos set qty = qty - old.qty where id = old.id_insumo;
      end if;
      if not new.revertido then
        update insumos set qty = qty + new.qty where id = new.id_insumo;
      end if;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists movimientos_stock_aplicar on public.movimientos_stock;
create trigger movimientos_stock_aplicar
after insert or delete or update of qty, id_insumo, revertido on public.movimientos_stock
for each row
execute function public.aplicar_movimiento_stock();

-- 4. Triggers de documento ------------------------------------------------------------
create or replace function public.validar_estado_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Con sesión de usuario, o con el rol anónimo de PostgREST, se exige rol. Sin sesión y sin
  -- ser anon (SQL Editor, service role) se permite sin chequear rol.
  v_controlar boolean := auth.uid() is not null or coalesce(auth.role(), '') = 'anon';
  v_rol public.rol_usuario;
begin
  -- Documento anulado: no se modifica nada. Se tolera solo que created_by / anulado_por
  -- pasen a null (on delete set null al borrar un perfil).
  if old.estado_documento = 'anulado' and new.estado_documento = 'anulado' then
    if (to_jsonb(new) - 'created_by' - 'anulado_por') is distinct from (to_jsonb(old) - 'created_by' - 'anulado_por')
       or (new.anulado_por is not null and new.anulado_por is distinct from old.anulado_por)
       or (new.created_by is not null and new.created_by is distinct from old.created_by) then
      raise exception 'El documento está anulado y no se puede modificar. Un administrador debe reactivarlo antes de editarlo.';
    end if;
    return new;
  end if;

  if old.estado_documento = 'vigente' and new.estado_documento = 'anulado' then
    if v_controlar then
      v_rol := public.rol_actual();
      if v_rol is null or v_rol not in ('contador', 'admin') then
        raise exception 'Solo un contador o un administrador puede anular un documento.'
          using errcode = '42501';
      end if;
    end if;
    new.anulado_at := now();
    new.anulado_por := case
      when auth.uid() is not null and exists (select 1 from public.perfiles where id = auth.uid())
        then auth.uid()
      else null
    end;
  elsif old.estado_documento = 'anulado' and new.estado_documento = 'vigente' then
    if v_controlar then
      v_rol := public.rol_actual();
      if v_rol is null or v_rol <> 'admin' then
        raise exception 'Solo un administrador puede reactivar un documento anulado.'
          using errcode = '42501';
      end if;
    end if;
    new.anulado_por := null;
    new.anulado_at := null;
    new.motivo_anulacion := null;
  else
    -- vigente -> vigente: los datos de anulación no se escriben a mano.
    new.anulado_por := null;
    new.anulado_at := null;
    new.motivo_anulacion := null;
  end if;
  return new;
end;
$$;

drop trigger if exists facturas_validar_estado on public.facturas;
create trigger facturas_validar_estado
before update on public.facturas
for each row
execute function public.validar_estado_documento();

drop trigger if exists boletas_validar_estado on public.boletas;
create trigger boletas_validar_estado
before update on public.boletas
for each row
execute function public.validar_estado_documento();

-- Al anular marca revertido = true en los movimientos de todas las líneas del documento;
-- al reactivar los vuelve a false. El trigger de movimientos_stock ajusta insumos.qty.
-- Un documento sin líneas simplemente no afecta filas.
create or replace function public.sincronizar_stock_estado_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revertir boolean := (new.estado_documento = 'anulado');
begin
  if tg_table_name = 'facturas' then
    update movimientos_stock m
    set revertido = v_revertir
    where m.revertido is distinct from v_revertir
      and m.id_detalle_factura in (select d.id from detalle_facturas d where d.id_factura = new.id);
  else
    update movimientos_stock m
    set revertido = v_revertir
    where m.revertido is distinct from v_revertir
      and m.id_detalle_boleta in (select d.id from detalle_boletas d where d.id_boleta = new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists facturas_sincronizar_stock_estado on public.facturas;
create trigger facturas_sincronizar_stock_estado
after update on public.facturas
for each row
when (old.estado_documento is distinct from new.estado_documento)
execute function public.sincronizar_stock_estado_documento();

drop trigger if exists boletas_sincronizar_stock_estado on public.boletas;
create trigger boletas_sincronizar_stock_estado
after update on public.boletas
for each row
when (old.estado_documento is distinct from new.estado_documento)
execute function public.sincronizar_stock_estado_documento();

-- 5. Líneas de un documento anulado: sin INSERT ni UPDATE ---------------------------------
-- Argumentos del trigger: (tabla del documento, columna FK de la línea hacia el documento).
create or replace function public.bloquear_lineas_documento_anulado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_estado public.estado_documento;
begin
  v_ids := array[(to_jsonb(new) ->> tg_argv[1])::uuid];

  if tg_op = 'UPDATE' then
    -- on delete set null de id_solicitud_compra (borrar una solicitud vinculada): lo ejecuta una
    -- acción referencial, es decir, un trigger anidado (profundidad > 1). Una edición directa
    -- del cliente tiene profundidad 1 y sigue bloqueada.
    if pg_trigger_depth() > 1
       and (to_jsonb(new) - 'id_solicitud_compra') = (to_jsonb(old) - 'id_solicitud_compra')
       and (to_jsonb(new) ->> 'id_solicitud_compra') is null then
      return new;
    end if;
    v_ids := v_ids || (to_jsonb(old) ->> tg_argv[1])::uuid;
  end if;

  foreach v_id in array v_ids loop
    if v_id is null then
      continue;
    end if;
    execute format('select estado_documento from public.%I where id = $1 for share', tg_argv[0])
      into v_estado using v_id;
    if v_estado = 'anulado' then
      raise exception 'El documento está anulado: no se pueden agregar ni modificar sus líneas. Un administrador debe reactivarlo primero.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists detalle_facturas_bloquear_si_anulada on public.detalle_facturas;
create trigger detalle_facturas_bloquear_si_anulada
before insert or update on public.detalle_facturas
for each row
execute function public.bloquear_lineas_documento_anulado('facturas', 'id_factura');

drop trigger if exists detalle_boletas_bloquear_si_anulada on public.detalle_boletas;
create trigger detalle_boletas_bloquear_si_anulada
before insert or update on public.detalle_boletas
for each row
execute function public.bloquear_lineas_documento_anulado('boletas', 'id_boleta');

-- 6. Comprobaciones finales (la migración no debe cambiar datos ni stock) ----------------------
do $$
declare
  v_n bigint;
  v_antes numeric := current_setting('okima.t6a_stock')::numeric;
  v_despues numeric;
begin
  select coalesce(sum(qty), 0) into v_despues from public.insumos;
  if v_despues <> v_antes then
    raise exception 'T6a: la suma de insumos.qty cambió (% -> %); se aborta sin cambios.', v_antes, v_despues;
  end if;

  -- En la primera aplicación todo debe quedar vigente y sin movimientos revertidos. En una
  -- re-ejecución puede haber documentos anulados legítimos, así que no se exige.
  if current_setting('okima.t6a_reaplicada') <> 'true' then
    select count(*) into v_n from public.movimientos_stock where revertido;
    if v_n > 0 then
      raise exception 'T6a: hay % movimientos revertidos justo al migrar; se esperaba 0.', v_n;
    end if;

    select (select count(*) from public.facturas where estado_documento <> 'vigente')
         + (select count(*) from public.boletas where estado_documento <> 'vigente')
    into v_n;
    if v_n > 0 then
      raise exception 'T6a: hay % documentos no vigentes justo al migrar; se esperaba 0.', v_n;
    end if;
  end if;

  raise notice 'T6a: migración lista. % facturas y % boletas quedan vigentes; stock total sin cambios (%).',
    (select count(*) from public.facturas), (select count(*) from public.boletas), v_despues;
end
$$;

commit;
