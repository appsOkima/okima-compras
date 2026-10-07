-- Sprint 2 / T7a: tabla `pagos`, migración del gasto histórico y vista de estado de pago.
-- ⚠ BASE DE PRODUCCIÓN: una sola transacción; si cualquier comprobación falla, no cambia nada.
-- Solo base de datos: el Resumen (T7b) y la interfaz (T7c) no se tocan aquí. Hasta T7b el
-- Resumen sigue sumando facturas.total / boletas.monto, así que esta migración no cambia
-- ningún número visible.
--
-- Qué hace (en este orden):
--   1. Comprobaciones previas (`raise exception` ANTES de tocar nada): existen facturas, boletas,
--      perfiles, facturas/boletas.estado_documento (migración 09) y asignar_created_by()
--      (migración 05). Bloquea escrituras en facturas y boletas mientras dura. Anota si la tabla
--      `pagos` ya existía (re-ejecución) para decidir si migra datos.
--   2. Tabla `pagos` (create table if not exists):
--        id, created_at, monto (> 0), fecha_pago, id_factura, id_boleta (CHECK: exactamente uno),
--        notas, created_by (FK a perfiles, on delete set null).
--      Las FK a facturas y boletas son SIN `on delete cascade` A PROPÓSITO: un documento con pagos
--      NO se puede borrar mientras los tenga (el Admin debe borrar antes sus pagos). Es una
--      protección del flujo de caja: borrar una factura no debe hacer desaparecer en silencio el
--      gasto ya pagado. (Efecto colateral: el borrado de una factura o boleta desde la interfaz
--      fallará para toda factura con pagos, incluidas todas las migradas; T7c debe manejarlo.)
--      Índices en fecha_pago, id_factura e id_boleta. Trigger BEFORE INSERT `asignar_created_by`
--      (el existente) llena created_by desde auth.uid(). RLS habilitado con la política
--      `acceso_publico` como las demás tablas (el corte por rol es T3b).
--   3. Migración de datos históricos: un pago por CADA factura y CADA boleta existente que aún no
--      tenga pagos, con monto = facturas.total / boletas.monto, fecha_pago = fecha del documento
--      (decisión confirmada por el usuario) y notas = 'Migración histórica: pago al contado'.
--      Incluye documentos anulados (su pago existe; el Resumen lo excluirá por el estado del
--      documento, y al reactivarlo vuelve a contar sin más pasos).
--      * facturas.total y boletas.monto son NOT NULL en el esquema, así que no hay nulos que
--        considerar. Total/monto <= 0 NO puede tener pago (CHECK monto > 0): se omite y se avisa con
--        `raise notice` (cuántos y hasta 20 ids). No aborta: no hay nada que cobrar; en la vista
--        quedan como 'pagado' (total 0, nada adeudado). Un total negativo (nota de crédito) queda
--        igual sin pago y avisado.
--      * Idempotencia: SOLO se migra cuando la tabla `pagos` se crea en esta ejecución. En una
--        re-ejecución se omite toda la migración de datos y se avisa. Motivo: tras la primera
--        aplicación, una factura sin pagos es legítima (compra a crédito aún no pagada); volver a
--        "migrar" a todo documento sin pagos la marcaría como pagada al contado en silencio. Por
--        la misma razón un pago borrado a mano a propósito no se recrea.
--      * Verificación con `raise exception` (aborta todo): Σ pagos migrados = Σ totales de los
--        documentos migrados, por separado para facturas y boletas, y ningún documento con
--        total/monto > 0 queda sin pago.
--   4. Vista `vista_estado_pago` (security_invoker = true): una fila por documento (union de
--      facturas y boletas). Columnas: tipo ('factura' | 'boleta'), id_documento, fecha,
--      estado_documento, total, pagado (suma de pagos, 0 si no hay), saldo (total - pagado),
--      estado_pago:
--        'anulado'   si el documento está anulado (sin estado de pago; sus pagos se conservan);
--        'pagado'    si pagado >= total (incluye total 0 y el SOBREPAGO: pagado > total queda
--                    'pagado' con saldo NEGATIVO; la interfaz avisa);
--        'pendiente' si pagado = 0;
--        'parcial'   en otro caso.
--      Agrega los pagos por documento antes de unir (sin duplicar filas por LEFT JOIN).
-- NO se agrega RPC de pago al contado (T9). NO se cambia UNIQUE (id_proveedor, numero_factura).
-- Comprobación posterior: 2026-10-02-10-verificacion.sql.
-- Reversa: 2026-10-02-10-pagos-down.sql (pierde los pagos manuales ingresados después).

begin;

-- 1. Comprobaciones previas (nada se ha modificado todavía) -------------------
do $$
begin
  if to_regclass('public.facturas') is null
     or to_regclass('public.boletas') is null
     or to_regclass('public.perfiles') is null then
    raise exception 'T7a: faltan tablas (facturas, boletas, perfiles). Aplicar antes las migraciones 01-09.';
  end if;

  if to_regprocedure('public.asignar_created_by()') is null then
    raise exception 'T7a: falta public.asignar_created_by() (migración 05).';
  end if;

  if not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'facturas' and column_name = 'estado_documento')
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'boletas' and column_name = 'estado_documento') then
    raise exception 'T7a: faltan facturas/boletas.estado_documento (migración 09 sin aplicar).';
  end if;
end
$$;

lock table public.facturas, public.boletas in share row exclusive mode;

-- ¿La tabla pagos se crea en esta ejecución? (variable local a la transacción)
select set_config('okima.t7a_creada', (to_regclass('public.pagos') is null)::text, true);

-- 2. Tabla pagos -----------------------------------------------------------------
create table if not exists public.pagos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  monto       numeric not null check (monto > 0),
  fecha_pago  date not null,
  -- SIN on delete cascade: un documento con pagos no se puede borrar mientras los tenga.
  id_factura  uuid references public.facturas (id),
  id_boleta   uuid references public.boletas (id),
  notas       text,
  created_by  uuid references public.perfiles (id) on delete set null,
  constraint pagos_documento_unico_check check (num_nonnulls(id_factura, id_boleta) = 1)
);

create index if not exists pagos_fecha_pago_idx on public.pagos (fecha_pago);
create index if not exists pagos_id_factura_idx on public.pagos (id_factura);
create index if not exists pagos_id_boleta_idx on public.pagos (id_boleta);

comment on table public.pagos is
  'Flujo de caja: cada pago de una factura o de una boleta. Las FK no tienen cascade: un documento con pagos no se puede borrar. El Resumen suma solo pagos de documentos vigentes.';
comment on column public.pagos.id_factura is 'Factura que se paga (exactamente uno de id_factura / id_boleta). Sin on delete cascade.';
comment on column public.pagos.id_boleta is 'Boleta que se paga (exactamente uno de id_factura / id_boleta). Sin on delete cascade.';
comment on column public.pagos.created_by is 'Quién registró el pago (auth.uid() vía asignar_created_by); null en históricos y en SQL Editor.';

drop trigger if exists asignar_created_by on public.pagos;
create trigger asignar_created_by before insert on public.pagos
  for each row execute function public.asignar_created_by();

alter table public.pagos enable row level security;
drop policy if exists "acceso_publico" on public.pagos;
create policy "acceso_publico" on public.pagos
  for all to anon, authenticated using (true) with check (true);

-- 3. Migración de datos históricos (solo si la tabla se creó en esta ejecución) -----------
do $$
declare
  v_marca constant text := 'Migración histórica: pago al contado';
  v_ids text;
  v_n bigint;
  v_n_pagos bigint;
  v_suma_doc numeric;
  v_suma_pagos numeric;
begin
  if current_setting('okima.t7a_creada') <> 'true' then
    raise notice 'T7a: la tabla pagos ya existía; se OMITE la migración de datos históricos (no se re-migra para no marcar como pagados documentos a crédito).';
    return;
  end if;

  -- Documentos que no pueden tener pago (total/monto <= 0). Los NULL no existen (NOT NULL).
  select string_agg(id::text, ', ') into v_ids
  from (select id from public.facturas where total <= 0 order by created_at limit 20) x;
  select count(*) into v_n from public.facturas where total <= 0;
  if v_n > 0 then
    raise notice 'T7a: % facturas con total <= 0 quedan SIN pago (ids, máx. 20): %', v_n, v_ids;
  end if;

  select string_agg(id::text, ', ') into v_ids
  from (select id from public.boletas where monto <= 0 order by created_at limit 20) x;
  select count(*) into v_n from public.boletas where monto <= 0;
  if v_n > 0 then
    raise notice 'T7a: % boletas con monto <= 0 quedan SIN pago (ids, máx. 20): %', v_n, v_ids;
  end if;

  insert into public.pagos (monto, fecha_pago, id_factura, notas)
  select f.total, f.fecha, f.id, v_marca
  from public.facturas f
  where f.total > 0
    and not exists (select 1 from public.pagos p where p.id_factura = f.id);

  insert into public.pagos (monto, fecha_pago, id_boleta, notas)
  select b.monto, b.fecha, b.id, v_marca
  from public.boletas b
  where b.monto > 0
    and not exists (select 1 from public.pagos p where p.id_boleta = b.id);

  -- Verificación facturas: Σ pagos migrados = Σ totales (> 0) y ninguna factura con total > 0 sin pago.
  select coalesce(sum(total), 0) into v_suma_doc from public.facturas where total > 0;
  select coalesce(sum(monto), 0) into v_suma_pagos from public.pagos where id_factura is not null and notas = v_marca;
  if v_suma_doc <> v_suma_pagos then
    raise exception 'T7a: Σ pagos migrados de facturas (%) <> Σ totales de facturas (%); se aborta sin cambios.', v_suma_pagos, v_suma_doc;
  end if;
  select count(*) into v_n from public.facturas f
  where f.total > 0 and not exists (select 1 from public.pagos p where p.id_factura = f.id);
  if v_n > 0 then
    raise exception 'T7a: % facturas con total > 0 quedaron sin pago; se aborta sin cambios.', v_n;
  end if;

  -- Verificación boletas.
  select coalesce(sum(monto), 0) into v_suma_doc from public.boletas where monto > 0;
  select coalesce(sum(monto), 0) into v_suma_pagos from public.pagos where id_boleta is not null and notas = v_marca;
  if v_suma_doc <> v_suma_pagos then
    raise exception 'T7a: Σ pagos migrados de boletas (%) <> Σ montos de boletas (%); se aborta sin cambios.', v_suma_pagos, v_suma_doc;
  end if;
  select count(*) into v_n from public.boletas b
  where b.monto > 0 and not exists (select 1 from public.pagos p where p.id_boleta = b.id);
  if v_n > 0 then
    raise exception 'T7a: % boletas con monto > 0 quedaron sin pago; se aborta sin cambios.', v_n;
  end if;

  select count(*) into v_n_pagos from public.pagos;
  raise notice 'T7a: % pagos históricos creados (% facturas, % boletas); Σ pagos = Σ totales verificado por separado.',
    v_n_pagos,
    (select count(*) from public.pagos where id_factura is not null),
    (select count(*) from public.pagos where id_boleta is not null);
end
$$;

-- 4. Vista de estado de pago --------------------------------------------------------
-- security_invoker: respeta el RLS de facturas, boletas y pagos de quien consulta.
-- Los pagos se agregan por documento ANTES de unir, así no se multiplican filas.
create or replace view public.vista_estado_pago
with (security_invoker = true) as
select
  d.tipo,
  d.id_documento,
  d.fecha,
  d.estado_documento,
  d.total,
  coalesce(p.pagado, 0)             as pagado,
  d.total - coalesce(p.pagado, 0)   as saldo,
  case
    when d.estado_documento = 'anulado' then 'anulado'
    when coalesce(p.pagado, 0) >= d.total then 'pagado'
    when coalesce(p.pagado, 0) = 0 then 'pendiente'
    else 'parcial'
  end                               as estado_pago
from (
  select 'factura'::text as tipo, f.id as id_documento, f.fecha, f.estado_documento, f.total
  from public.facturas f
  union all
  select 'boleta'::text, b.id, b.fecha, b.estado_documento, b.monto
  from public.boletas b
) d
left join (
  select 'factura'::text as tipo, id_factura as id_documento, sum(monto) as pagado
  from public.pagos where id_factura is not null group by id_factura
  union all
  select 'boleta'::text, id_boleta, sum(monto)
  from public.pagos where id_boleta is not null group by id_boleta
) p on p.tipo = d.tipo and p.id_documento = d.id_documento;

comment on view public.vista_estado_pago is
  'Una fila por factura/boleta con pagado y saldo (total - pagado). estado_pago: anulado | pagado (pagado >= total; sobrepago = saldo negativo) | pendiente | parcial.';

commit;
