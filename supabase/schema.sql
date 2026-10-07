-- =============================================================================
-- Okima Compras — esquema inicial (Fase 1)
--
-- Ejecutar una sola vez, sobre una base limpia, en el SQL Editor de Supabase.
-- Modelo y razonamiento: CLAUDE.md e historial-decisiones.md.
--
-- Convenciones:
--   * PK `id uuid default gen_random_uuid()` y `created_at timestamptz` en todas las tablas.
--   * Montos en CLP (numeric), sin excepciones.
--   * Campos nullable donde la "creación al vuelo" los deja vacíos.
--   * Sin UNIQUE sobre `nombre`: el chequeo de duplicados es de aplicación.
--   * RLS por rol (Sprint 2 / T3b): sin acceso para anon; políticas por rol al final del archivo.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

-- El orden de declaración define el orden de ORDER BY: Baja < Media < Alta.
create type nivel_urgencia as enum ('Baja', 'Media', 'Alta');

-- Estado de facturas y boletas (Sprint 2 / T6a). Las solicitudes mantienen 'Cancelada'.
create type estado_documento as enum ('vigente', 'anulado');

-- -----------------------------------------------------------------------------
-- 8. categorias (centros de costo)
-- -----------------------------------------------------------------------------
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nombre      text not null,
  activo      boolean not null default true
);

-- -----------------------------------------------------------------------------
-- 10. subcategorias (compartida por insumos, boletas y plantillas)
-- -----------------------------------------------------------------------------
-- Insumos, boletas y plantillas referencian solo la subcategoría; la categoría
-- (centro de costo) se obtiene a través de ella.
create table subcategorias (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  id_categoria  uuid not null references categorias (id),
  nombre        text not null,
  descripcion   text,  -- ítems incluidos, ej: "Papeles, Toner (solo negro)"
  activo        boolean not null default true
);

create index subcategorias_id_categoria_idx on subcategorias (id_categoria);

-- -----------------------------------------------------------------------------
-- 1. proveedores
-- -----------------------------------------------------------------------------
create table proveedores (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  nombre               text not null,
  codigo               text,
  rut                  text not null,  -- obligatorio incluso al crear al vuelo
  direccion_1          text,
  direccion_2          text,
  email_1              text,
  email_2              text,
  fono_1               text,
  fono_2               text,
  datos_transferencia  text,
  notas                text
);

-- -----------------------------------------------------------------------------
-- 2. insumos (insumos internos de Okima)
-- -----------------------------------------------------------------------------
create table insumos (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  nombre           text not null,
  id_subcategoria  uuid not null references subcategorias (id),  -- obligatoria incluso al vuelo
  codigo           text,
  ancho            numeric,  -- mm
  alto             numeric,  -- mm
  profundidad      numeric,  -- mm
  venta_directa    boolean,
  precio_venta     numeric,  -- aplica cuando venta_directa = true
  qty              numeric not null default 0,  -- acepta decimales; lo mueven los triggers de movimientos_stock
  descripcion      text,
  notas            text  -- indicaciones de interacción; vacío no se muestra
);

create index insumos_id_subcategoria_idx on insumos (id_subcategoria);

-- -----------------------------------------------------------------------------
-- 3. insumos_proveedores (catálogo de cada proveedor)
-- -----------------------------------------------------------------------------
create table insumos_proveedores (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  -- El vínculo con insumos Okima vive en insumos_proveedores_okima (N:M, Sprint 2 / T4a).
  nombre               text not null,
  codigo               text,
  id_proveedor         uuid not null references proveedores (id),
  precio_clp           numeric,
  ancho                numeric,
  alto                 numeric,
  profundidad          numeric,
  -- Descriptivos del formato de compra; ya NO gobiernan el stock (lo hace factor_conversion).
  cantidad_formato     numeric,
  formato_unidad       text,
  fecha_actualizacion  date,
  link_insumo          text,
  descripcion          text,
  notas                text  -- indicaciones de interacción; vacío no se muestra
);

create index insumos_proveedores_id_proveedor_idx on insumos_proveedores (id_proveedor);

-- -----------------------------------------------------------------------------
-- 3b. insumos_proveedores_okima (pivote N:M insumo del proveedor ↔ insumo Okima)
-- -----------------------------------------------------------------------------
-- factor_conversion: unidades Okima que se obtienen por cada unidad del proveedor
-- (3 proveedores del mismo tazón: 3 filas al mismo insumo con factor 1; una resma
-- que rinde 2000 hojas: factor 2000). Nunca se crea en silencio ni al vuelo:
-- solo el administrador ("Por vincular") o el usuario con confirmación en Facturas.
-- Detalle: migraciones/2026-10-02-07-insumos-proveedores-okima.sql.
create table insumos_proveedores_okima (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  id_insumo_proveedor  uuid not null references insumos_proveedores (id) on delete cascade,
  id_insumo_okima      uuid not null references insumos (id) on delete cascade,
  factor_conversion    numeric not null check (factor_conversion > 0),
  constraint insumos_proveedores_okima_par_key unique (id_insumo_proveedor, id_insumo_okima)
);

create index insumos_proveedores_okima_id_insumo_proveedor_idx on insumos_proveedores_okima (id_insumo_proveedor);
create index insumos_proveedores_okima_id_insumo_okima_idx on insumos_proveedores_okima (id_insumo_okima);

-- -----------------------------------------------------------------------------
-- 4. solicitudes_compra
-- -----------------------------------------------------------------------------
create table solicitudes_compra (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  solicitante          text not null,
  id_insumo_okima      uuid not null references insumos (id),
  cantidad_solicitada  numeric not null check (cantidad_solicitada > 0),
  nivel_urgencia       nivel_urgencia not null default 'Media',
  fecha_esperada       date,
  estado               text not null default 'Pendiente'
                       check (estado in ('Pendiente', 'Comprada', 'Cancelada')),
  notas                text  -- indicaciones de interacción; vacío no se muestra
);

create index solicitudes_compra_id_insumo_okima_idx on solicitudes_compra (id_insumo_okima);
create index solicitudes_compra_estado_idx on solicitudes_compra (estado);

-- -----------------------------------------------------------------------------
-- 5. facturas (cabecera)
-- -----------------------------------------------------------------------------
-- El usuario solo ingresa el descuento global en %; neto, IVA y total los
-- calcula la interfaz desde las líneas y se guardan ya calculados (para el ERP):
--   neto = round(Σ subtotales × (1 − descuento_pct / 100)); iva = round(neto × 0,19); total = neto + iva.
create table facturas (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  id_proveedor     uuid not null references proveedores (id),
  numero_factura   text not null,
  fecha            date not null,
  neto_total       numeric not null default 0,
  descuento_pct    numeric not null default 0
                   constraint facturas_descuento_pct_check check (descuento_pct between 0 and 100),
  iva              numeric not null default 0,
  total            numeric not null default 0,
  notas            text,  -- indicaciones de interacción; vacío no se muestra
  constraint facturas_proveedor_numero_key unique (id_proveedor, numero_factura)
);

-- -----------------------------------------------------------------------------
-- 6. detalle_facturas (líneas)
-- -----------------------------------------------------------------------------
create table detalle_facturas (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  id_factura           uuid not null references facturas (id) on delete cascade,
  id_insumo_proveedor  uuid not null references insumos_proveedores (id),
  id_solicitud_compra  uuid references solicitudes_compra (id) on delete set null,
  cantidad             numeric not null check (cantidad > 0),
  precio_neto          numeric not null,
  descuento_pct        numeric not null default 0
                       constraint detalle_facturas_descuento_pct_check check (descuento_pct between 0 and 100),
  -- Calculado por la interfaz: round(cantidad × precio_neto × (1 − descuento_pct / 100)).
  subtotal             numeric not null
);

create index detalle_facturas_id_factura_idx on detalle_facturas (id_factura);
create index detalle_facturas_id_insumo_proveedor_idx on detalle_facturas (id_insumo_proveedor);
create index detalle_facturas_id_solicitud_compra_idx on detalle_facturas (id_solicitud_compra);

-- -----------------------------------------------------------------------------
-- 6b. movimientos_stock (stock aplicado por cada línea, uno por insumo Okima)
-- -----------------------------------------------------------------------------
-- Reemplaza detalle_facturas.id_insumo_stock / qty_stock: una línea puede afectar
-- varios insumos (pivote N:M). Los triggers de abajo mantienen insumos.qty:
-- INSERT suma, DELETE resta, UPDATE de qty/id_insumo/revertido revierte y reaplica; los
-- movimientos revertidos (documento anulado) no cuentan: ni suman al insertarse ni restan
-- al borrarse. Borrar la línea o la factura (cascada) revierte el stock sin código adicional.
-- id_insumo SIN cascade: borrar un insumo con movimientos falla a propósito
-- (el historial de stock no se pierde en silencio).
-- Los movimientos también nacen de líneas de boleta (T5a): id_detalle_factura es
-- nullable y id_detalle_boleta se agrega más abajo, en la sección de detalle_boletas
-- (la tabla se declara después de boletas), con CHECK de origen único.
create table movimientos_stock (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  id_detalle_factura  uuid references detalle_facturas (id) on delete cascade,
  id_insumo           uuid not null references insumos (id),
  qty                 numeric not null,
  -- true = revertido por la anulación de su documento (T6a): se conserva el registro pero ya
  -- no cuenta en insumos.qty. Reactivar el documento lo devuelve a false (reaplica exacto qty).
  revertido           boolean not null default false
);

create unique index movimientos_stock_detalle_factura_insumo_key on movimientos_stock (id_detalle_factura, id_insumo);
create index movimientos_stock_id_insumo_idx on movimientos_stock (id_insumo);

-- SECURITY DEFINER: el RLS por rol impide que algunos roles actualicen insumos;
-- el stock lo mueve siempre el trigger.
create function aplicar_movimiento_stock()
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

create trigger movimientos_stock_aplicar
after insert or delete or update of qty, id_insumo, revertido on movimientos_stock
for each row
execute function aplicar_movimiento_stock();

-- Regla de negocio: una línea de factura asociada a una solicitud de compra
-- marca esa solicitud como 'Comprada' (al insertar la línea o al asociarla después).
create function marcar_solicitud_comprada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update solicitudes_compra
  set estado = 'Comprada'
  where id = new.id_solicitud_compra
    and estado <> 'Comprada';
  return new;
end;
$$;

create trigger detalle_facturas_marcar_solicitud_comprada
after insert or update of id_solicitud_compra on detalle_facturas
for each row
when (new.id_solicitud_compra is not null)
execute function marcar_solicitud_comprada();

-- Regla de negocio: al guardar la línea, por cada fila de la pivote de su
-- insumo_proveedor se genera un movimiento con qty = cantidad × factor_conversion
-- (y el trigger de movimientos_stock suma a insumos.qty). Sin filas en la pivote
-- no hay stock, y vincular después no lo aplica retroactivamente. Al cambiar
-- cantidad o insumo_proveedor se borran los movimientos de la línea (revierte) y
-- se regeneran; editar otros campos no toca el stock.
-- SECURITY DEFINER: escribe movimientos_stock aunque el rol no tenga permiso directo.
create function generar_movimientos_stock_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    delete from movimientos_stock where id_detalle_factura = new.id;
  end if;

  insert into movimientos_stock (id_detalle_factura, id_insumo, qty)
  select new.id, po.id_insumo_okima, new.cantidad * po.factor_conversion
  from insumos_proveedores_okima po
  where po.id_insumo_proveedor = new.id_insumo_proveedor;
  return null;
end;
$$;

create trigger detalle_facturas_generar_stock_ins
after insert on detalle_facturas
for each row
execute function generar_movimientos_stock_factura();

create trigger detalle_facturas_generar_stock_upd
after update on detalle_facturas
for each row
when (old.cantidad is distinct from new.cantidad
      or old.id_insumo_proveedor is distinct from new.id_insumo_proveedor)
execute function generar_movimientos_stock_factura();

-- -----------------------------------------------------------------------------
-- 9. plantillas_gastos_recurrentes
-- -----------------------------------------------------------------------------
create table plantillas_gastos_recurrentes (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  nombre           text not null,  -- ej: Arriendo, Sueldos, Pago IVA
  id_subcategoria  uuid references subcategorias (id),
  monto_default    numeric not null default 0,  -- editable; pre-llena el monto del gasto
  activo           boolean not null default true
);

-- -----------------------------------------------------------------------------
-- 7. boletas (antes otros_gastos)
-- -----------------------------------------------------------------------------
create table boletas (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  concepto                 text not null,
  id_subcategoria          uuid references subcategorias (id),
  -- Si viene de un atajo de gasto recurrente, indica de cuál plantilla (la boleta nace de un gasto recurrente).
  id_plantilla_recurrente  uuid references plantillas_gastos_recurrentes (id),
  id_proveedor             uuid references proveedores (id),
  -- Total de la boleta en CLP = Σ subtotal de sus líneas (detalle_boletas). Lo calcula y guarda
  -- la interfaz, como el total de facturas; la base no lo recalcula.
  monto                    numeric not null,
  fecha                    date not null default current_date,
  numero_documento         text,
  notas                    text
);

create index boletas_id_subcategoria_idx on boletas (id_subcategoria);
create index boletas_id_plantilla_recurrente_idx on boletas (id_plantilla_recurrente);
create index boletas_id_proveedor_idx on boletas (id_proveedor);
create index boletas_fecha_idx on boletas (fecha);

-- -----------------------------------------------------------------------------
-- 7b. detalle_boletas (líneas de boleta; Sprint 2 / T5a)
-- -----------------------------------------------------------------------------
-- La boleta es la cabecera y boletas.monto el total de las líneas (calculado por la
-- interfaz). Sin notas (decisión del usuario). id_solicitud_compra (T8a) vincula la línea
-- con la solicitud que la originó, igual que en detalle_facturas.
-- id_insumo_proveedor es opcional (arriendo, sueldos y servicios no tienen insumo) y
-- SIN cascade, igual que detalle_facturas. precio = CLP por unidad, IVA incluido según
-- la boleta (sin descuento ni IVA discriminado). subtotal lo calcula la interfaz:
-- round(cantidad × precio). vista_solicitudes_pendientes y el Resumen no se tocan.
create table detalle_boletas (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  id_boleta            uuid not null references boletas (id) on delete cascade,
  descripcion          text not null,
  id_insumo_proveedor  uuid references insumos_proveedores (id),
  id_solicitud_compra  uuid references solicitudes_compra (id) on delete set null,
  cantidad             numeric not null default 1 check (cantidad > 0),
  precio               numeric not null,
  subtotal             numeric not null
);

create index detalle_boletas_id_boleta_idx on detalle_boletas (id_boleta);
create index detalle_boletas_id_insumo_proveedor_idx on detalle_boletas (id_insumo_proveedor);
create index detalle_boletas_id_solicitud_compra_idx on detalle_boletas (id_solicitud_compra);

comment on table detalle_boletas is
  'Líneas de boleta. boletas.monto es el total de estas líneas (lo calcula y guarda la interfaz; la base no lo recalcula).';
comment on column detalle_boletas.id_insumo_proveedor is
  'Opcional: arriendo, sueldos y servicios no tienen insumo. Si está vinculado en la pivote, la línea mueve stock.';
comment on column detalle_boletas.id_solicitud_compra is
  'Solicitud de compra que originó esta línea (opcional). Varias líneas pueden apuntar a la misma solicitud. Una solicitud no puede tener líneas de factura y de boleta a la vez (validar_exclusividad_solicitud). Marca la solicitud como ''Comprada'' (marcar_solicitud_comprada).';
comment on column detalle_facturas.id_solicitud_compra is
  'Solicitud de compra que originó esta línea (opcional). Varias líneas pueden apuntar a la misma solicitud. Una solicitud no puede tener líneas de factura y de boleta a la vez (validar_exclusividad_solicitud). Marca la solicitud como ''Comprada'' (marcar_solicitud_comprada).';
comment on column detalle_boletas.precio is
  'CLP por unidad, IVA incluido según la boleta (sin descuento ni IVA discriminado).';
comment on column detalle_boletas.subtotal is
  'Calculado por la interfaz: round(cantidad × precio). La base no lo calcula.';
comment on column boletas.monto is
  'Total de la boleta en CLP = suma de subtotal de sus líneas (detalle_boletas). Lo calcula y guarda la interfaz; la base no lo recalcula.';

-- movimientos_stock admite líneas de boleta: cada movimiento nace de una línea de factura
-- O de una de boleta. Borrar la línea o la boleta (cascade) revierte el stock vía trigger.
alter table movimientos_stock
  add column id_detalle_boleta uuid references detalle_boletas (id) on delete cascade,
  add constraint movimientos_stock_origen_check
    check (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1);

create unique index movimientos_stock_detalle_boleta_insumo_key on movimientos_stock (id_detalle_boleta, id_insumo);

-- Análogo a generar_movimientos_stock_factura: por cada fila de la pivote del
-- insumo_proveedor de la línea, qty = cantidad × factor_conversion. Sin insumo_proveedor
-- o sin filas en la pivote no hay stock (vincular después no lo aplica retroactivamente).
-- Al cambiar cantidad o insumo_proveedor se borran los movimientos de la línea (revierte)
-- y se regeneran.
create function generar_movimientos_stock_boleta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    delete from movimientos_stock where id_detalle_boleta = new.id;
  end if;

  insert into movimientos_stock (id_detalle_boleta, id_insumo, qty)
  select new.id, po.id_insumo_okima, new.cantidad * po.factor_conversion
  from insumos_proveedores_okima po
  where po.id_insumo_proveedor = new.id_insumo_proveedor;
  return null;
end;
$$;

create trigger detalle_boletas_generar_stock_ins
after insert on detalle_boletas
for each row
execute function generar_movimientos_stock_boleta();

create trigger detalle_boletas_generar_stock_upd
after update on detalle_boletas
for each row
when (old.cantidad is distinct from new.cantidad
      or old.id_insumo_proveedor is distinct from new.id_insumo_proveedor)
execute function generar_movimientos_stock_boleta();

-- Regla 'Comprada' también para líneas de boleta (T8a): se reutiliza marcar_solicitud_comprada()
-- (no es SECURITY DEFINER: solo contador y admin escriben líneas y ambos pueden actualizar
-- solicitudes_compra).
create trigger detalle_boletas_marcar_solicitud_comprada
after insert or update of id_solicitud_compra on detalle_boletas
for each row
when (new.id_solicitud_compra is not null)
execute function marcar_solicitud_comprada();

-- Exclusividad (T8a): una solicitud no puede tener líneas de factura y de boleta a la vez
-- (varias líneas de la MISMA tabla sí). SECURITY DEFINER para mirar la otra tabla sin que el RLS
-- la oculte. Serializa por solicitud con un candado consultivo de transacción (no FOR UPDATE:
-- chocaría con el FOR KEY SHARE de la FK y podría dar deadlock). Las líneas de documentos
-- anulados cuentan como vínculo. El on delete set null no la dispara (valor null). Límite: dos
-- INSERT en una misma sentencia (CTE sobre ambas tablas) no se ven entre sí.
-- Detalle: migraciones/2026-10-02-12-vinculo-solicitud-boletas.sql
create function validar_exclusividad_solicitud()
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

create trigger detalle_facturas_validar_exclusividad_solicitud
before insert or update of id_solicitud_compra on detalle_facturas
for each row
when (new.id_solicitud_compra is not null)
execute function validar_exclusividad_solicitud();

create trigger detalle_boletas_validar_exclusividad_solicitud
before insert or update of id_solicitud_compra on detalle_boletas
for each row
when (new.id_solicitud_compra is not null)
execute function validar_exclusividad_solicitud();

-- -----------------------------------------------------------------------------
-- Vista: vista_solicitudes_pendientes (Función 1: lista e impresión)
-- -----------------------------------------------------------------------------
-- Solo 'Pendiente', ordenada Alta → Media → Baja, con el insumo, la fecha tope y
-- los proveedores sugeridos: los de insumos_proveedores vinculados a ese insumo
-- a través de la pivote insumos_proveedores_okima.
-- security_invoker hace que la vista respete el RLS de las tablas base.
create view vista_solicitudes_pendientes
with (security_invoker = true) as
select
  s.id,
  s.created_at,
  s.solicitante,
  s.id_insumo_okima,
  i.nombre                          as insumo_nombre,
  s.cantidad_solicitada,
  s.nivel_urgencia,
  s.fecha_esperada,
  s.estado,
  coalesce(sug.proveedores_sugeridos, '') as proveedores_sugeridos,
  s.notas,
  i.notas                           as notas_insumo,
  sug.notas_proveedores,
  sug.notas_catalogo
from solicitudes_compra s
join insumos i on i.id = s.id_insumo_okima
left join lateral (
  select
    string_agg(distinct p.nombre, ', ' order by p.nombre) as proveedores_sugeridos,
    -- Para la hoja impresa: solo las notas con contenido, una por línea.
    string_agg(distinct p.nombre || ': ' || btrim(p.notas), E'
')
      filter (where btrim(coalesce(p.notas, '')) <> '') as notas_proveedores,
    string_agg(distinct p.nombre || ' · ' || ip.nombre || ': ' || btrim(ip.notas), E'
')
      filter (where btrim(coalesce(ip.notas, '')) <> '') as notas_catalogo
  from insumos_proveedores_okima po
  join insumos_proveedores ip on ip.id = po.id_insumo_proveedor
  join proveedores p on p.id = ip.id_proveedor
  where po.id_insumo_okima = s.id_insumo_okima
) sug on true
where s.estado = 'Pendiente'
order by s.nivel_urgencia desc, s.fecha_esperada asc nulls last, s.created_at asc;

-- -----------------------------------------------------------------------------
-- Perfiles de usuario (Sprint 2 / T3a). Detalle: migraciones/2026-10-02-05-perfiles.sql
-- -----------------------------------------------------------------------------
-- El rol y el nombre vienen de raw_app_meta_data (solo service role), nunca de
-- raw_user_meta_data. Sin rol válido no se crea perfil (mínimo privilegio).
create type rol_usuario as enum ('productor', 'contador', 'admin');

create table perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  rol             rol_usuario not null,
  nombre_mostrar  text not null
);

alter table perfiles enable row level security;
create policy "perfiles_lectura" on perfiles for select to authenticated using (true);

create function crear_perfil_desde_auth()
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
    return new;
  end if;
  insert into public.perfiles (id, rol, nombre_mostrar)
  values (new.id, v_rol::public.rol_usuario, coalesce(v_nombre, split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger crear_perfil_al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_desde_auth();

-- SECURITY DEFINER con search_path fijo: las políticas por rol (T3b) la usan sin recursión.
create function rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

revoke all on function rol_actual() from public;
grant execute on function rol_actual() to authenticated;

-- Trazabilidad: quién creó cada registro y a qué perfil corresponde el solicitante
-- (el texto `solicitante` se conserva). Los históricos quedan en null.
alter table solicitudes_compra
  add column id_solicitante uuid references perfiles (id) on delete set null,
  add column created_by     uuid references perfiles (id) on delete set null;
alter table facturas add column created_by uuid references perfiles (id) on delete set null;
alter table boletas  add column created_by uuid references perfiles (id) on delete set null;

create index solicitudes_compra_id_solicitante_idx on solicitudes_compra (id_solicitante);

-- created_by sale de auth.uid() y pisa lo que mande el cliente; sin sesión o sin perfil queda como venga.
create function asignar_created_by()
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

create trigger asignar_created_by before insert on solicitudes_compra
  for each row execute function asignar_created_by();
create trigger asignar_created_by before insert on facturas
  for each row execute function asignar_created_by();
create trigger asignar_created_by before insert on boletas
  for each row execute function asignar_created_by();

-- -----------------------------------------------------------------------------
-- Estado "Anulado" en facturas y boletas (Sprint 2 / T6a)
-- Detalle y casos límite: migraciones/2026-10-02-09-estado-anulado.sql
-- -----------------------------------------------------------------------------
alter table facturas
  add column estado_documento estado_documento not null default 'vigente',
  add column anulado_por      uuid references perfiles (id) on delete set null,
  add column anulado_at       timestamptz,
  add column motivo_anulacion text;  -- opcional en la base; la interfaz lo pide
alter table boletas
  add column estado_documento estado_documento not null default 'vigente',
  add column anulado_por      uuid references perfiles (id) on delete set null,
  add column anulado_at       timestamptz,
  add column motivo_anulacion text;

-- Parciales sobre los anulados (pocos): el Resumen filtra por 'vigente', casi todo.
create index facturas_anuladas_idx on facturas (anulado_at) where estado_documento = 'anulado';
create index boletas_anuladas_idx on boletas (anulado_at) where estado_documento = 'anulado';

comment on column facturas.estado_documento is
  'vigente | anulado. Anular revierte el stock (movimientos_stock.revertido) y excluye el documento de totales; solo contador/admin anula, solo admin reactiva.';
comment on column boletas.estado_documento is
  'vigente | anulado. Anular revierte el stock (movimientos_stock.revertido) y excluye el documento de totales; solo contador/admin anula, solo admin reactiva.';
comment on column facturas.motivo_anulacion is 'Opcional en la base; la interfaz lo pide al anular.';
comment on column boletas.motivo_anulacion is 'Opcional en la base; la interfaz lo pide al anular.';

-- BEFORE UPDATE (facturas y boletas): un documento anulado no se modifica (salvo created_by /
-- anulado_por -> null por on delete set null); vigente->anulado exige contador/admin y fija
-- anulado_at/anulado_por; anulado->vigente exige admin y limpia los datos de anulación. El rol
-- se exige con sesión (auth.uid()) o con el rol anon; sin sesión y sin anon (SQL Editor,
-- service role) se permite sin chequear rol.
create function validar_estado_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_controlar boolean := auth.uid() is not null or coalesce(auth.role(), '') = 'anon';
  v_rol public.rol_usuario;
begin
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
    new.anulado_por := null;
    new.anulado_at := null;
    new.motivo_anulacion := null;
  end if;
  return new;
end;
$$;

create trigger facturas_validar_estado
before update on facturas
for each row
execute function validar_estado_documento();

create trigger boletas_validar_estado
before update on boletas
for each row
execute function validar_estado_documento();

-- AFTER UPDATE del estado: anular marca revertido = true en los movimientos de todas las
-- líneas del documento (el trigger de movimientos_stock resta); reactivar los pone en false
-- (reaplica exacto lo revertido, sin recalcular con la pivote actual).
create function sincronizar_stock_estado_documento()
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

create trigger facturas_sincronizar_stock_estado
after update on facturas
for each row
when (old.estado_documento is distinct from new.estado_documento)
execute function sincronizar_stock_estado_documento();

create trigger boletas_sincronizar_stock_estado
after update on boletas
for each row
when (old.estado_documento is distinct from new.estado_documento)
execute function sincronizar_stock_estado_documento();

-- Líneas de un documento anulado: sin INSERT ni UPDATE (el DELETE, incluida la cascada del
-- Admin, sigue permitido y no resta stock: sus movimientos ya están revertidos). Argumentos:
-- (tabla del documento, columna FK de la línea). `for share` serializa contra una anulación
-- concurrente. El on delete set null de id_solicitud_compra (acción referencial, trigger
-- anidado: pg_trigger_depth() > 1) se permite. No bloquea a generar_movimientos_stock_*: son
-- AFTER de las líneas y no se disparan si la línea no se puede insertar ni actualizar.
create function bloquear_lineas_documento_anulado()
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

create trigger detalle_facturas_bloquear_si_anulada
before insert or update on detalle_facturas
for each row
execute function bloquear_lineas_documento_anulado('facturas', 'id_factura');

create trigger detalle_boletas_bloquear_si_anulada
before insert or update on detalle_boletas
for each row
execute function bloquear_lineas_documento_anulado('boletas', 'id_boleta');

-- -----------------------------------------------------------------------------
-- Pagos (Sprint 2 / T7a). Detalle: migraciones/2026-10-02-10-pagos.sql
-- -----------------------------------------------------------------------------
-- Flujo de caja: cada pago de una factura o de una boleta (exactamente una de las dos).
-- Las FK a facturas y boletas son SIN on delete cascade a propósito: un documento con pagos
-- no se puede borrar mientras los tenga. En base limpia no hay histórico que migrar.
create table pagos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  monto       numeric not null check (monto > 0),
  fecha_pago  date not null,
  id_factura  uuid references facturas (id),
  id_boleta   uuid references boletas (id),
  notas       text,
  created_by  uuid references perfiles (id) on delete set null,
  constraint pagos_documento_unico_check check (num_nonnulls(id_factura, id_boleta) = 1)
);

create index pagos_fecha_pago_idx on pagos (fecha_pago);
create index pagos_id_factura_idx on pagos (id_factura);
create index pagos_id_boleta_idx on pagos (id_boleta);

comment on table pagos is
  'Flujo de caja: cada pago de una factura o de una boleta. Las FK no tienen cascade: un documento con pagos no se puede borrar. El Resumen suma solo pagos de documentos vigentes.';
comment on column pagos.id_factura is 'Factura que se paga (exactamente uno de id_factura / id_boleta). Sin on delete cascade.';
comment on column pagos.id_boleta is 'Boleta que se paga (exactamente uno de id_factura / id_boleta). Sin on delete cascade.';
comment on column pagos.created_by is 'Quién registró el pago (auth.uid() vía asignar_created_by); null en históricos y en SQL Editor.';

create trigger asignar_created_by before insert on pagos
  for each row execute function asignar_created_by();

-- Estado de pago por documento (una fila por factura/boleta). 'anulado' si el documento está
-- anulado; 'pagado' si pagado >= total (incluye total 0; el sobrepago queda 'pagado' con saldo
-- negativo); 'pendiente' si pagado = 0; 'parcial' en otro caso. security_invoker: respeta el RLS.
create view vista_estado_pago
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
  from facturas f
  union all
  select 'boleta'::text, b.id, b.fecha, b.estado_documento, b.monto
  from boletas b
) d
left join (
  select 'factura'::text as tipo, id_factura as id_documento, sum(monto) as pagado
  from pagos where id_factura is not null group by id_factura
  union all
  select 'boleta'::text, id_boleta, sum(monto)
  from pagos where id_boleta is not null group by id_boleta
) p on p.tipo = d.tipo and p.id_documento = d.id_documento;

comment on view vista_estado_pago is
  'Una fila por factura/boleta con pagado y saldo (total - pagado). estado_pago: anulado | pagado (pagado >= total; sobrepago = saldo negativo) | pendiente | parcial.';

-- -----------------------------------------------------------------------------
-- RLS por rol (Sprint 2 / T3b). Detalle: migraciones/2026-10-02-11-rls-por-rol.sql
-- -----------------------------------------------------------------------------
-- Todo el acceso requiere sesión con perfil: anon no tiene privilegios y sin perfil
-- (rol_actual() null) no se ve nada. perfiles conserva perfiles_lectura (definida arriba).
-- Políticas separadas por tabla y comando; (select ...) hace que rol_actual() se evalúe una vez.
--
-- Matriz aplicada (S = select, I = insert, U = update, D = delete); p = productor, c = contador, a = admin:
--   categorias                     S:pca I:a   U:a   D:a
--   subcategorias                  S:pca I:a   U:a   D:a
--   proveedores                    S:pca I:ca  U:ca  D:a
--   insumos_proveedores            S:pca I:ca  U:ca  D:a
--   insumos                        S:pca I:pca U:pca D:a
--   insumos_proveedores_okima      S:pca I:pca U:pca D:ca
--   solicitudes_compra             S:pca I:pca U:pca D:a
--   facturas                       S:ca  I:ca  U:ca  D:a
--   detalle_facturas               S:ca  I:ca  U:ca  D:ca
--   movimientos_stock              S:ca  I:a   U:a   D:a
--   plantillas_gastos_recurrentes  S:ca  I:a   U:a   D:a
--   boletas                        S:ca  I:ca  U:ca  D:a
--   detalle_boletas                S:ca  I:ca  U:ca  D:ca
--   pagos                          S:ca  I:ca  U:a   D:a
--   perfiles: perfiles_lectura (select authenticated), sin políticas de escritura (ni siquiera admin).
--   anon: ningún acceso. Sin sesión o sin perfil (rol_actual() null): ningún acceso.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end
$$;

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

-- -----------------------------------------------------------------------------
-- Datos semilla
-- -----------------------------------------------------------------------------
-- Categorías (centros de costo) y subcategorías, desde centros_de_costo.csv.
-- La columna "Items Incluidos" queda en subcategorias.descripcion.
insert into categorias (nombre) values
  ('GASTOS ADMINISTRATIVOS Y FIJOS'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA'),
  ('IMPRESIÓN DIRECTA Y GRABADO LÁSER'),
  ('MARQUETERÍA'),
  ('SUBLIMACIÓN Y ESTAMPADOS'),
  ('FOTOGRAFÍA QUÍMICA'),
  ('TIENDA / PRODUCTO DIRECTO'),
  ('HERRAMIENTAS Y TALLER'),
  ('INVERSIONES Y PROYECTOS ESPECIALES');

insert into subcategorias (id_categoria, nombre, descripcion)
select c.id, v.nombre, v.descripcion
from (values
  ('GASTOS ADMINISTRATIVOS Y FIJOS',     'Remuneraciones',                        'Sueldos líquidos, Imposiciones'),
  ('GASTOS ADMINISTRATIVOS Y FIJOS',     'Infraestructura',                       'Arriendo, Servicios básicos (Luz, agua, internet)'),
  ('GASTOS ADMINISTRATIVOS Y FIJOS',     'Impuestos y Finanzas',                  'IVA, Patentes, Gastos bancarios'),
  ('GASTOS ADMINISTRATIVOS Y FIJOS',     'Operación de Oficina',                  'Artículos de aseo, Útiles de oficina'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Roland SG300',                          'Rollos de plotter (vinilos, telas, etc.), Cartridges de tinta, Cartridge cleaner, Kit de limpieza'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Roland RF640',                          'Rollos de plotter, Botellas de tinta, Botella cleaner, Kit de limpieza'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'HP LATEX 335',                          'Rollos de plotter, Cartridges de tinta, Kit de mantención'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Sustratos Rígidos',                     'Planchas de foam, Sintra, Acrílicos generales'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Laminadora en Caliente (Gran Formato)', 'Rollos de laminado para plotter'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Laminadora en Frío',                    'Rollos de laminado mate'),
  ('IMPRESIÓN GRAN FORMATO (PLOTTERS)',  'Mantención de Máquinas y Repuestos',    'Gastos técnicos, cambio de cabezales, repuestos mecánicos'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Canon imagePRESS C700',                 'Papeles (couché, bond, opalina, adhesivo, etc.), Toner CMYK'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Ricoh Aficio 5054',                     'Papeles, Toner (solo negro)'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Encuadernación y Soportes',             'Cartón piedra, Vinil adhesivo para encuadernar, Cintas de encuadernación (fastback), Corchetes'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Plastificadora',                        'Micas de encapsulado'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Laminadora en Caliente (Polimate)',     'Rollos de polimate (para impresión digital)'),
  ('IMPRESIÓN DIGITAL Y PAPELERÍA',      'Mantención de Máquinas y Repuestos',    'Visitas técnicas, cambio de fusores, repuestos internos'),
  ('IMPRESIÓN DIRECTA Y GRABADO LÁSER',  'Roland VersaUV LEF12',                  'Cartridges de tinta UV, líquidos de limpieza'),
  ('IMPRESIÓN DIRECTA Y GRABADO LÁSER',  'Objetos para personalizar',             'Lápices, galvanos, llaveros, cerámicas, pendrives, etc.'),
  ('IMPRESIÓN DIRECTA Y GRABADO LÁSER',  'Sustratos rígidos especiales',          'Lamicoid, Acrílicos especiales para grabado/corte'),
  ('IMPRESIÓN DIRECTA Y GRABADO LÁSER',  'Mantención de Máquinas y Repuestos',    'Cambios de tubos láser, espejos, repuestos mecánicos o de cabezales UV'),
  ('MARQUETERÍA',                        'Insumos de Enmarcado',                  'Molduras, Vidrios, Traseras, Passepartout'),
  ('MARQUETERÍA',                        'Materiales Auxiliares',                 'Puntas auxiliares, Cintas adhesivas, Cola fría, Cinta engomada'),
  ('MARQUETERÍA',                        'Mantención de Máquinas y Repuestos',    'Afilado de cuchillos, repuestos para ensambladoras o cortadoras'),
  ('SUBLIMACIÓN Y ESTAMPADOS',           'Insumos de Impresión',                  'Hojas de sublimación, Tintas de sublimación (Sawgrass, Epson), Compra de DTF Textil'),
  ('SUBLIMACIÓN Y ESTAMPADOS',           'Sustratos en Blanco (Blanks)',          'Poleras, Textiles en general, Objetos sublimables'),
  ('SUBLIMACIÓN Y ESTAMPADOS',           'Mantención de Máquinas y Repuestos',    'Arreglo de resistencias de planchas, repuestos de impresoras pequeñas'),
  ('FOTOGRAFÍA QUÍMICA',                 'Papel Fotográfico',                     'Rollos de papel fotosensible de distintos anchos/superficies'),
  ('FOTOGRAFÍA QUÍMICA',                 'Procesos Químicos',                     'Revelador, blanqueador, fijador, estabilizador y regeneradores'),
  ('FOTOGRAFÍA QUÍMICA',                 'Mantención Minilab y Repuestos',        'Filtros, lámparas, piezas mecánicas de la procesadora y visitas técnicas'),
  ('TIENDA / PRODUCTO DIRECTO',          'Venta Directa',                         'Productos de reventa que no sufren intervención en el taller'),
  ('HERRAMIENTAS Y TALLER',              'Herramientas de Uso General',           'Despuntadora, Tijeras, Cutters, Reglas, herramientas de mano que usan todas las áreas'),
  ('INVERSIONES Y PROYECTOS ESPECIALES', 'Infraestructura y Remodelaciones',      'Compra de muebles, cerámicas, pintura, arreglos estructurales del local'),
  ('INVERSIONES Y PROYECTOS ESPECIALES', 'Tecnología y Sistemas',                 'Implementación de sistemas ERP, compra de computadores, licencias de software definitivas')
) as v (categoria, nombre, descripcion)
join categorias c on c.nombre = v.categoria;

insert into plantillas_gastos_recurrentes (nombre, id_subcategoria, monto_default)
select v.nombre, s.id, 0
from (values
  ('Arriendo', 'Infraestructura'),
  ('Sueldos',  'Remuneraciones'),
  ('Pago IVA', 'Impuestos y Finanzas')
) as v (nombre, subcategoria)
join subcategorias s on s.nombre = v.subcategoria
join categorias c on c.id = s.id_categoria and c.nombre = 'GASTOS ADMINISTRATIVOS Y FIJOS';

commit;
