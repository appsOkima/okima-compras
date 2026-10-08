-- Sprint 2 / T3a: perfiles de usuario, rol_actual() y trazabilidad.
-- ADITIVA: no toca las políticas RLS existentes ("acceso_publico"; eso es T3b),
-- así que el acceso actual de la app no cambia.
--   * enum rol_usuario y tabla perfiles (1:1 con auth.users).
--   * Trigger en auth.users que crea el perfil leyendo rol y nombre de
--     raw_app_meta_data (solo editable con service role). NUNCA de
--     raw_user_meta_data: el propio usuario puede modificarlo y se daría el rol.
--     Si falta el rol o no es válido, NO se crea perfil: sin perfil no hay
--     acceso (mínimo privilegio) y se detecta en la app. Sin nombre_mostrar se
--     usa la parte local del email.
--   * public.rol_actual(): rol del auth.uid(), SECURITY DEFINER para que las
--     políticas futuras no recursen sobre perfiles.
--   * id_solicitante (solicitudes_compra) y created_by (solicitudes_compra,
--     facturas, boletas), nullable, on delete set null. `pagos` aún no existe (T7).
--   * created_by lo llena un trigger before insert desde auth.uid() (siempre
--     pisa lo que mande el cliente, para que no se pueda falsear). Sin sesión
--     (SQL Editor, service role, anon) queda lo que venga, normalmente null.
-- perfiles: RLS con lectura para authenticated y sin escritura por clientes
-- (se escribe con el trigger o con service role, que se salta el RLS).
-- Idempotente. Reversa: 2026-10-02-05-perfiles-down.sql.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario' and typnamespace = 'public'::regnamespace) then
    create type public.rol_usuario as enum ('productor', 'contador', 'admin');
  end if;
end
$$;

create table if not exists public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  rol             public.rol_usuario not null,
  nombre_mostrar  text not null
);

alter table public.perfiles enable row level security;

drop policy if exists "perfiles_lectura" on public.perfiles;
create policy "perfiles_lectura" on public.perfiles
  for select to authenticated using (true);

-- Perfil a partir de los metadatos de la app (raw_app_meta_data).
create or replace function public.crear_perfil_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := new.raw_app_meta_data ->> 'rol';
  v_nombre text := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'nombre_mostrar', '')), '');
begin
  if v_rol is null or v_rol not in ('productor', 'contador', 'admin') then
    return new;  -- sin rol válido no hay perfil (mínimo privilegio)
  end if;
  insert into public.perfiles (id, rol, nombre_mostrar)
  values (new.id, v_rol::public.rol_usuario, coalesce(v_nombre, split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists crear_perfil_al_crear_usuario on auth.users;
create trigger crear_perfil_al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_desde_auth();

create or replace function public.rol_actual()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

revoke all on function public.rol_actual() from public;
grant execute on function public.rol_actual() to authenticated;

-- Trazabilidad.
alter table public.solicitudes_compra
  add column if not exists id_solicitante uuid references public.perfiles (id) on delete set null,
  add column if not exists created_by     uuid references public.perfiles (id) on delete set null;
alter table public.facturas
  add column if not exists created_by uuid references public.perfiles (id) on delete set null;
alter table public.boletas
  add column if not exists created_by uuid references public.perfiles (id) on delete set null;

create index if not exists solicitudes_compra_id_solicitante_idx on public.solicitudes_compra (id_solicitante);

-- Solo asigna si hay sesión Y ese usuario tiene perfil (si no, la FK fallaría).
create or replace function public.asignar_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (select 1 from public.perfiles where id = auth.uid()) then
    new.created_by := auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists asignar_created_by on public.solicitudes_compra;
create trigger asignar_created_by before insert on public.solicitudes_compra
  for each row execute function public.asignar_created_by();
drop trigger if exists asignar_created_by on public.facturas;
create trigger asignar_created_by before insert on public.facturas
  for each row execute function public.asignar_created_by();
drop trigger if exists asignar_created_by on public.boletas;
create trigger asignar_created_by before insert on public.boletas
  for each row execute function public.asignar_created_by();

commit;
