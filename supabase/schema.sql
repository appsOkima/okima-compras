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
--   * Sin login: RLS habilitado con políticas permisivas para anon y authenticated.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

-- El orden de declaración define el orden de ORDER BY: Baja < Media < Alta.
create type nivel_urgencia as enum ('Baja', 'Media', 'Alta');

-- -----------------------------------------------------------------------------
-- 8. categorias (compartida por insumos, otros_gastos y plantillas)
-- -----------------------------------------------------------------------------
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nombre      text not null,
  activo      boolean not null default true
);

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
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  nombre         text not null,
  id_categoria   uuid not null references categorias (id),  -- obligatoria incluso al vuelo
  codigo         text,
  ancho          numeric,  -- mm
  alto           numeric,  -- mm
  profundidad    numeric,  -- mm
  venta_directa  boolean,
  precio_venta   numeric,  -- aplica cuando venta_directa = true
  qty            integer not null default 0,  -- se actualiza al guardar líneas de factura
  descripcion    text
);

create index insumos_id_categoria_idx on insumos (id_categoria);

-- -----------------------------------------------------------------------------
-- 3. insumos_proveedores (catálogo de cada proveedor)
-- -----------------------------------------------------------------------------
create table insumos_proveedores (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  -- Nunca se llena al crear al vuelo; solo lo vincula el administrador (revisión semanal).
  id_insumo_okima      uuid references insumos (id) on delete set null,
  nombre               text not null,
  codigo               text,
  id_proveedor         uuid not null references proveedores (id),
  precio_clp           numeric,
  ancho                numeric,
  alto                 numeric,
  profundidad          numeric,
  cantidad_formato     numeric,  -- unidades internas por formato de compra
  formato_unidad       text,
  fecha_actualizacion  date,
  link_insumo          text,
  descripcion          text
);

create index insumos_proveedores_id_insumo_okima_idx on insumos_proveedores (id_insumo_okima);
create index insumos_proveedores_id_proveedor_idx on insumos_proveedores (id_proveedor);

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
                       check (estado in ('Pendiente', 'Comprada', 'Cancelada'))
);

create index solicitudes_compra_id_insumo_okima_idx on solicitudes_compra (id_insumo_okima);
create index solicitudes_compra_estado_idx on solicitudes_compra (estado);

-- -----------------------------------------------------------------------------
-- 5. facturas (cabecera)
-- -----------------------------------------------------------------------------
-- Los totales se ingresan tal cual figuran en la factura física; la interfaz
-- avisa si no cuadran con la suma de detalle_facturas.
create table facturas (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  id_proveedor     uuid not null references proveedores (id),
  numero_factura   text not null,
  fecha            date not null,
  neto_total       numeric not null default 0,
  descuento_total  numeric not null default 0,
  iva              numeric not null default 0,
  total            numeric not null default 0,
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
  descuento            numeric not null default 0,
  subtotal             numeric not null
);

create index detalle_facturas_id_factura_idx on detalle_facturas (id_factura);
create index detalle_facturas_id_insumo_proveedor_idx on detalle_facturas (id_insumo_proveedor);
create index detalle_facturas_id_solicitud_compra_idx on detalle_facturas (id_solicitud_compra);

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

-- -----------------------------------------------------------------------------
-- 9. plantillas_gastos_recurrentes
-- -----------------------------------------------------------------------------
create table plantillas_gastos_recurrentes (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  nombre         text not null,  -- ej: Arriendo, Sueldos, Pago IVA
  id_categoria   uuid references categorias (id),
  monto_default  numeric not null default 0,  -- editable; pre-llena el monto del gasto
  activo         boolean not null default true
);

-- -----------------------------------------------------------------------------
-- 7. otros_gastos
-- -----------------------------------------------------------------------------
create table otros_gastos (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  concepto                 text not null,
  id_categoria             uuid references categorias (id),
  -- Si viene de un atajo de gasto recurrente, indica de cuál plantilla.
  id_plantilla_recurrente  uuid references plantillas_gastos_recurrentes (id),
  id_proveedor             uuid references proveedores (id),
  monto                    numeric not null,
  fecha                    date not null default current_date,
  numero_documento         text,
  notas                    text
);

create index otros_gastos_id_categoria_idx on otros_gastos (id_categoria);
create index otros_gastos_id_plantilla_recurrente_idx on otros_gastos (id_plantilla_recurrente);
create index otros_gastos_id_proveedor_idx on otros_gastos (id_proveedor);
create index otros_gastos_fecha_idx on otros_gastos (fecha);

-- -----------------------------------------------------------------------------
-- Vista: vista_solicitudes_pendientes (Función 1: lista e impresión)
-- -----------------------------------------------------------------------------
-- Solo 'Pendiente', ordenada Alta → Media → Baja, con el insumo, la fecha tope y
-- los proveedores sugeridos: los de insumos_proveedores vinculados a ese insumo.
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
  coalesce(sug.proveedores_sugeridos, '') as proveedores_sugeridos
from solicitudes_compra s
join insumos i on i.id = s.id_insumo_okima
left join lateral (
  select string_agg(distinct p.nombre, ', ' order by p.nombre) as proveedores_sugeridos
  from insumos_proveedores ip
  join proveedores p on p.id = ip.id_proveedor
  where ip.id_insumo_okima = s.id_insumo_okima
) sug on true
where s.estado = 'Pendiente'
order by s.nivel_urgencia desc, s.fecha_esperada asc nulls last, s.created_at asc;

-- -----------------------------------------------------------------------------
-- RLS: habilitado en todas las tablas, acceso total sin login (MVP)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias',
    'proveedores',
    'insumos',
    'insumos_proveedores',
    'solicitudes_compra',
    'facturas',
    'detalle_facturas',
    'plantillas_gastos_recurrentes',
    'otros_gastos'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "acceso_publico" on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Datos semilla
-- -----------------------------------------------------------------------------
-- Categorías: pendiente la lista inicial. Cuando esté, agregar aquí, ej.:
-- insert into categorias (nombre) values ('Papelería'), ('Embalaje');

insert into plantillas_gastos_recurrentes (nombre, monto_default) values
  ('Arriendo', 0),
  ('Sueldos', 0),
  ('Pago IVA', 0);

commit;
