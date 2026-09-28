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
-- 10. subcategorias (compartida por insumos, otros_gastos y plantillas)
-- -----------------------------------------------------------------------------
-- Insumos, gastos y plantillas referencian solo la subcategoría; la categoría
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
  qty              numeric not null default 0,  -- acepta decimales; lo mueve el trigger de stock
  descripcion      text
);

create index insumos_id_subcategoria_idx on insumos (id_subcategoria);

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
  subtotal             numeric not null,
  -- Stock aplicado al guardar la línea (lo llena el trigger, no la interfaz):
  -- permite revertir exactamente lo sumado si la línea se edita o se borra.
  id_insumo_stock      uuid references insumos (id),
  qty_stock            numeric
);

create index detalle_facturas_id_factura_idx on detalle_facturas (id_factura);
create index detalle_facturas_id_insumo_proveedor_idx on detalle_facturas (id_insumo_proveedor);
create index detalle_facturas_id_solicitud_compra_idx on detalle_facturas (id_solicitud_compra);
create index detalle_facturas_id_insumo_stock_idx on detalle_facturas (id_insumo_stock);

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

-- Regla de negocio: si al guardar la línea su insumo_proveedor ya está vinculado
-- a un insumo Okima, insumos.qty += cantidad × cantidad_formato (1 si está vacío).
-- Sin vínculo no se guarda stock, y vincular después no lo aplica retroactivamente.
create function calcular_stock_detalle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Editar otros campos de la línea conserva el stock ya aplicado.
  if tg_op = 'UPDATE'
     and new.cantidad = old.cantidad
     and new.id_insumo_proveedor = old.id_insumo_proveedor then
    new.id_insumo_stock := old.id_insumo_stock;
    new.qty_stock := old.qty_stock;
    return new;
  end if;

  select ip.id_insumo_okima, new.cantidad * coalesce(ip.cantidad_formato, 1)
  into new.id_insumo_stock, new.qty_stock
  from insumos_proveedores ip
  where ip.id = new.id_insumo_proveedor;

  if new.id_insumo_stock is null then
    new.qty_stock := null;
  end if;
  return new;
end;
$$;

create function aplicar_stock_detalle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.id_insumo_stock is not distinct from old.id_insumo_stock
     and new.qty_stock is not distinct from old.qty_stock then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.id_insumo_stock is not null then
    update insumos set qty = qty - old.qty_stock where id = old.id_insumo_stock;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.id_insumo_stock is not null then
    update insumos set qty = qty + new.qty_stock where id = new.id_insumo_stock;
  end if;
  return null;
end;
$$;

create trigger detalle_facturas_calcular_stock
before insert or update on detalle_facturas
for each row
execute function calcular_stock_detalle();

create trigger detalle_facturas_aplicar_stock
after insert or update or delete on detalle_facturas
for each row
execute function aplicar_stock_detalle();

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
-- 7. otros_gastos
-- -----------------------------------------------------------------------------
create table otros_gastos (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  concepto                 text not null,
  id_subcategoria          uuid references subcategorias (id),
  -- Si viene de un atajo de gasto recurrente, indica de cuál plantilla.
  id_plantilla_recurrente  uuid references plantillas_gastos_recurrentes (id),
  id_proveedor             uuid references proveedores (id),
  monto                    numeric not null,
  fecha                    date not null default current_date,
  numero_documento         text,
  notas                    text
);

create index otros_gastos_id_subcategoria_idx on otros_gastos (id_subcategoria);
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
    'subcategorias',
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
