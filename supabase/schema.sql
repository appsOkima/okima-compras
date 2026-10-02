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
-- INSERT suma, DELETE resta, UPDATE de qty/id_insumo revierte y reaplica. Borrar
-- la línea o la factura (cascada) revierte el stock sin código adicional.
-- id_insumo SIN cascade: borrar un insumo con movimientos falla a propósito
-- (el historial de stock no se pierde en silencio).
-- Extensión prevista (T5, boletas): id_detalle_factura pasará a nullable, se
-- agregará id_detalle_boleta uuid references detalle_boletas (id) on delete cascade
-- y CHECK (num_nonnulls(id_detalle_factura, id_detalle_boleta) = 1).
create table movimientos_stock (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  id_detalle_factura  uuid not null references detalle_facturas (id) on delete cascade,
  id_insumo           uuid not null references insumos (id),
  qty                 numeric not null
);

create unique index movimientos_stock_detalle_factura_insumo_key on movimientos_stock (id_detalle_factura, id_insumo);
create index movimientos_stock_id_insumo_idx on movimientos_stock (id_insumo);

-- SECURITY DEFINER: más adelante el RLS por rol impedirá que algunos roles
-- actualicen insumos; el stock lo mueve siempre el trigger.
create function aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update insumos set qty = qty + new.qty where id = new.id_insumo;
  elsif tg_op = 'DELETE' then
    update insumos set qty = qty - old.qty where id = old.id_insumo;
  else
    if new.qty is distinct from old.qty or new.id_insumo is distinct from old.id_insumo then
      update insumos set qty = qty - old.qty where id = old.id_insumo;
      update insumos set qty = qty + new.qty where id = new.id_insumo;
    end if;
  end if;
  return null;
end;
$$;

create trigger movimientos_stock_aplicar
after insert or delete or update of qty, id_insumo on movimientos_stock
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
-- RLS: habilitado en todas las tablas, acceso total sin login (MVP)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias',
    'subcategorias',
    'proveedores',
    'insumos',
    'insumos_proveedores',
    'insumos_proveedores_okima',
    'solicitudes_compra',
    'facturas',
    'detalle_facturas',
    'movimientos_stock',
    'plantillas_gastos_recurrentes',
    'boletas'
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
