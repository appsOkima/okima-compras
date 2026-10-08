-- Reversa de 2026-10-02-05-perfiles.sql. Borra los perfiles y las columnas de
-- trazabilidad (created_by / id_solicitante se pierden). No toca auth.users.
begin;

drop trigger if exists asignar_created_by on public.solicitudes_compra;
drop trigger if exists asignar_created_by on public.facturas;
drop trigger if exists asignar_created_by on public.boletas;
drop function if exists public.asignar_created_by();

drop index if exists public.solicitudes_compra_id_solicitante_idx;
alter table public.solicitudes_compra drop column if exists id_solicitante, drop column if exists created_by;
alter table public.facturas drop column if exists created_by;
alter table public.boletas drop column if exists created_by;

drop trigger if exists crear_perfil_al_crear_usuario on auth.users;
drop function if exists public.crear_perfil_desde_auth();
drop function if exists public.rol_actual();
drop table if exists public.perfiles;
drop type if exists public.rol_usuario;

commit;
