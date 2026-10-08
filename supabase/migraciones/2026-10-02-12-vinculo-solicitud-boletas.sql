-- Sprint 2 / T8a: vínculo solicitud <-> línea de boleta, regla 'Comprada' y exclusividad.
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
--
-- Decisión de diseño (Sprint2.md §1.5): el vínculo vive EN LA LÍNEA. detalle_facturas ya tiene
-- id_solicitud_compra; aquí se agrega detalle_boletas.id_solicitud_compra. Varias líneas pueden
-- apuntar a la misma solicitud (compras parciales). Una solicitud puede estar vinculada a líneas
-- de factura O a líneas de boleta, NUNCA a ambas.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas (`raise exception` ANTES de tocar nada): exige las migraciones
--      01-11 (detalle_boletas, solicitudes_compra, detalle_facturas.id_solicitud_compra,
--      marcar_solicitud_comprada(), bloquear_lineas_documento_anulado()).
--   2. detalle_boletas.id_solicitud_compra uuid NULL references solicitudes_compra (id)
--      on delete set null (igual que en detalle_facturas) + índice. Columna nueva: todo null,
--      no hay datos que migrar.
--   3. Regla 'Comprada': se REUTILIZA marcar_solicitud_comprada() tal cual (solo usa
--      new.id_solicitud_compra) y se crea su trigger en detalle_boletas con el mismo disparo
--      que en facturas: after insert o update of id_solicitud_compra, cuando no es null.
--      No se hace SECURITY DEFINER: solo contador y admin insertan/actualizan líneas (RLS de la
--      migración 11) y ambos tienen UPDATE sobre solicitudes_compra, así que el UPDATE interno
--      funciona con sus propios permisos. Si algún día otro rol pudiera escribir líneas sin
--      poder actualizar solicitudes, el UPDATE afectaría 0 filas en silencio (no falla): en ese
--      caso habría que pasarla a SECURITY DEFINER con set search_path = public.
--   4. Exclusividad: validar_exclusividad_solicitud() (BEFORE INSERT OR UPDATE OF
--      id_solicitud_compra, en detalle_facturas y detalle_boletas). Solo actúa si
--      new.id_solicitud_compra no es null y, en UPDATE, si el valor cambia. Lanza una excepción
--      (errcode 23514) si la solicitud ya tiene líneas en la OTRA tabla. Varias líneas en la
--      MISMA tabla son válidas.
--        * SECURITY DEFINER con search_path fijo: lee la otra tabla sin que el RLS por rol la
--          oculte (un rol sin SELECT en ella se saltaría la regla).
--        * Concurrencia: pg_advisory_xact_lock(hashtext('solicitud_vinculo'),
--          hashtext(<id solicitud>)) antes de mirar la otra tabla; se libera al terminar la
--          transacción. Se eligió el candado consultivo y NO `select ... for update` sobre
--          solicitudes_compra porque FOR UPDATE choca con el FOR KEY SHARE que toma la propia FK
--          de las líneas (dos transacciones que ya insertaron una línea y luego intentan otra
--          podrían quedar en deadlock) y porque, bajo READ COMMITTED (PostgREST), cada consulta
--          interna del trigger toma snapshot nuevo, así que la segunda transacción ve lo
--          confirmado por la primera. Una colisión de hash solo serializa de más, nunca permite
--          un vínculo inválido.
--        * Líneas de documentos ANULADOS cuentan como vínculo (decisión conservadora): una
--          solicitud ligada solo a líneas de una factura anulada sigue vinculada a facturas;
--          para vincularla a una boleta hay que desvincular la línea (el admin reactiva el
--          documento y la edita) o borrarla (el borrado de líneas de un anulado sí se permite).
--        * No se dispara en acciones referenciales: el `on delete set null` deja el valor en
--          null y el trigger solo actúa con valores no nulos.
--        * Límite conocido: dos INSERT dentro de UNA MISMA sentencia (CTE con modificación de
--          datos en ambas tablas) no se ven entre sí por el snapshot; la interfaz no lo hace.
--   5. Compatibilidad con bloquear_lineas_documento_anulado() (migración 09): no requiere
--      cambios. Compara to_jsonb(new) - 'id_solicitud_compra' con to_jsonb(old) - ..., así que
--      la columna nueva queda excluida de la comparación; el set null referencial (depth > 1)
--      sigue permitido en documentos anulados.
--   6. RLS: sin cambios de políticas. detalle_boletas ya tiene las suyas (contador y admin
--      S/I/U/D) y las policies son por tabla, no por columna; una FK nueva no pide políticas
--      adicionales (la verificación de la FK la hace el sistema sin RLS).
--   7. Comprobación de consistencia (`raise exception`): ninguna solicitud con líneas en ambas
--      tablas, antes y después.
-- Idempotente: add column if not exists, create index if not exists, create or replace function,
-- drop trigger if exists + create trigger.
-- Comprobación posterior: 2026-10-02-12-verificacion.sql.
-- Reversa: 2026-10-02-12-vinculo-solicitud-boletas-down.sql.

begin;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
begin
  if to_regclass('public.detalle_boletas') is null
     or to_regclass('public.detalle_facturas') is null
     or to_regclass('public.solicitudes_compra') is null then
    raise exception 'T8a: faltan tablas (detalle_boletas, detalle_facturas, solicitudes_compra). Aplicar antes las migraciones 01-11.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'detalle_facturas' and column_name = 'id_solicitud_compra'
  ) then
    raise exception 'T8a: detalle_facturas.id_solicitud_compra no existe; el esquema no es el esperado.';
  end if;

  if to_regprocedure('public.marcar_solicitud_comprada()') is null then
    raise exception 'T8a: falta la función marcar_solicitud_comprada(); no hay regla ''Comprada'' que extender.';
  end if;

  if to_regprocedure('public.bloquear_lineas_documento_anulado()') is null then
    raise exception 'T8a: falta bloquear_lineas_documento_anulado() de la migración 09. Aplicar antes las migraciones 01-11.';
  end if;
end
$$;

-- 2. Columna e índice ---------------------------------------------------------------
alter table public.detalle_boletas
  add column if not exists id_solicitud_compra uuid
  references public.solicitudes_compra (id) on delete set null;

create index if not exists detalle_boletas_id_solicitud_compra_idx
  on public.detalle_boletas (id_solicitud_compra);

comment on column public.detalle_boletas.id_solicitud_compra is
  'Solicitud de compra que originó esta línea (opcional). Varias líneas pueden apuntar a la misma solicitud. Una solicitud no puede tener líneas de factura y de boleta a la vez (validar_exclusividad_solicitud). Marca la solicitud como ''Comprada'' (marcar_solicitud_comprada).';
comment on column public.detalle_facturas.id_solicitud_compra is
  'Solicitud de compra que originó esta línea (opcional). Varias líneas pueden apuntar a la misma solicitud. Una solicitud no puede tener líneas de factura y de boleta a la vez (validar_exclusividad_solicitud). Marca la solicitud como ''Comprada'' (marcar_solicitud_comprada).';

-- 3. Regla 'Comprada' también para líneas de boleta ---------------------------------
drop trigger if exists detalle_boletas_marcar_solicitud_comprada on public.detalle_boletas;
create trigger detalle_boletas_marcar_solicitud_comprada
after insert or update of id_solicitud_compra on public.detalle_boletas
for each row
when (new.id_solicitud_compra is not null)
execute function public.marcar_solicitud_comprada();

-- 4. Exclusividad factura / boleta ---------------------------------------------------
create or replace function public.validar_exclusividad_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otra boolean;
begin
  if new.id_solicitud_compra is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.id_solicitud_compra is not distinct from old.id_solicitud_compra then
    return new;
  end if;

  -- Serializa a quienes vinculan la MISMA solicitud (ver cabecera); se libera al cerrar la transacción.
  perform pg_advisory_xact_lock(hashtext('solicitud_vinculo'), hashtext(new.id_solicitud_compra::text));

  if tg_table_name = 'detalle_boletas' then
    select exists (
      select 1 from public.detalle_facturas where id_solicitud_compra = new.id_solicitud_compra
    ) into v_otra;
    if v_otra then
      raise exception 'La solicitud ya está vinculada a líneas de factura y no puede vincularse también a una boleta.'
        using errcode = '23514',
              hint = 'Una solicitud se asocia a líneas de factura O de boleta, nunca a ambas. Si la línea de factura pertenece a un documento anulado, también cuenta.';
    end if;
  else
    select exists (
      select 1 from public.detalle_boletas where id_solicitud_compra = new.id_solicitud_compra
    ) into v_otra;
    if v_otra then
      raise exception 'La solicitud ya está vinculada a líneas de boleta y no puede vincularse también a una factura.'
        using errcode = '23514',
              hint = 'Una solicitud se asocia a líneas de factura O de boleta, nunca a ambas. Si la línea de boleta pertenece a un documento anulado, también cuenta.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists detalle_facturas_validar_exclusividad_solicitud on public.detalle_facturas;
create trigger detalle_facturas_validar_exclusividad_solicitud
before insert or update of id_solicitud_compra on public.detalle_facturas
for each row
when (new.id_solicitud_compra is not null)
execute function public.validar_exclusividad_solicitud();

drop trigger if exists detalle_boletas_validar_exclusividad_solicitud on public.detalle_boletas;
create trigger detalle_boletas_validar_exclusividad_solicitud
before insert or update of id_solicitud_compra on public.detalle_boletas
for each row
when (new.id_solicitud_compra is not null)
execute function public.validar_exclusividad_solicitud();

-- 7. Consistencia de datos: ninguna solicitud en ambas tablas ------------------------------
do $$
declare
  v_n bigint;
  v_boletas_con_solicitud bigint;
begin
  select count(*) into v_n
  from (
    select id_solicitud_compra from public.detalle_facturas where id_solicitud_compra is not null
    intersect
    select id_solicitud_compra from public.detalle_boletas where id_solicitud_compra is not null
  ) x;
  if v_n > 0 then
    raise exception 'T8a: % solicitudes tienen líneas de factura Y de boleta a la vez; corregir los datos antes de aplicar (se aborta sin cambios).', v_n;
  end if;

  select count(*) into v_boletas_con_solicitud
  from public.detalle_boletas where id_solicitud_compra is not null;
  raise notice 'T8a: columna lista; líneas de boleta con solicitud: % (esperado 0 en una primera aplicación).', v_boletas_con_solicitud;
end
$$;

commit;
