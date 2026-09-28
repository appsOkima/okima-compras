-- =============================================================================
-- Okima Compras — datos de prueba (dummy) para todas las tablas
--
-- Ejecutar en el SQL Editor de Supabase, sobre una base con el schema.sql ya
-- cargado. Para borrarlos después: supabase/limpiar-datos.sql (vacía todo salvo
-- categorias y subcategorias).
--
-- Carga, con fechas relativas a hoy (últimos ~6 meses):
--   12 proveedores (algunos incompletos a propósito), 57 insumos Okima,
--   95 insumos de proveedor (65 vinculados, 30 "por vincular", algunos sin
--   precio/código), 50 solicitudes (Pendiente / Comprada / Cancelada, de las tres
--   urgencias), 26 facturas con 2–6 líneas cada una más ~9 líneas asociadas a
--   solicitudes (descuentos en %, totales ya calculados), 5 plantillas de gasto
--   recurrente y 41 otros gastos (6 meses de recurrentes + gastos sueltos).
-- Las líneas de factura pasan por los triggers reales: el stock (insumos.qty) y
-- el estado 'Comprada' de las solicitudes salen de la propia base.
--
-- No se ejecuta dos veces: si ya están los datos, se detiene sin cambiar nada
-- (correr limpiar-datos.sql primero). Los montos y nombres son inventados.
-- =============================================================================

begin;

do $$
begin
  if exists (select 1 from proveedores where nombre = 'Papelera Andina SpA') then
    raise exception 'Los datos de prueba ya están cargados. Ejecuta supabase/limpiar-datos.sql antes de volver a cargarlos.';
  end if;
end
$$;

-- Misma secuencia aleatoria en cada carga (reproducible dentro de la sesión).
select setseed(0.42);

-- -----------------------------------------------------------------------------
-- Proveedores (los 4, 9 y 12 quedan con datos incompletos para probar el filtro)
-- -----------------------------------------------------------------------------
insert into proveedores
  (nombre, codigo, rut, direccion_1, direccion_2, email_1, email_2, fono_1, fono_2, datos_transferencia, notas)
values
  ('Papelera Andina SpA',                 'PAP-01', '76.512.340-1', 'Av. Vicuña Mackenna 4520, Ñuñoa',  null,                       'ventas@papeleraandina.example',  'cobranza@papeleraandina.example', '+56 2 2555 1010', null,              'Banco Estado, cta. cte. 00123456789, ventas@papeleraandina.example', 'Despacha en 24 h en Santiago.'),
  ('Distribuidora Gráfica Sur Ltda.',     'DGS-02', '77.204.118-5', 'Camino Industrial 1280, Quilicura', 'Bodega 7',                 'pedidos@graficasur.example',     null,                              '+56 2 2777 2020', '+56 9 8765 4321', 'Banco de Chile, cta. cte. 55667788',                                  'Descuento por volumen sobre 10 resmas.'),
  ('Insumos Plotter Chile S.A.',          'IPC-03', '96.845.220-K', 'Av. Apoquindo 6410, Las Condes',    null,                       'comercial@plotterchile.example', 'soporte@plotterchile.example',    '+56 2 2444 3030', null,              'Banco Santander, cta. cte. 91827364',                                 'Importa tintas y vinilos. Plazo de entrega 5 a 7 días.'),
  ('Marquetería Valdivia',                null,     '76.098.771-3', null,                                null,                       null,                             null,                              '+56 63 222 4040', null,              null,                                                                  null),
  ('Químicos Fotográficos del Pacífico',  'QFP-05', '79.331.002-8', 'Los Carrera 340, Concepción',       null,                       'ventas@quimicospacifico.example',null,                              '+56 41 233 5050', null,              'Banco Estado, cta. vista 33445566',                                   'Solo despacha a regiones con flete por pagar.'),
  ('Textiles y Sublimados Ltda.',         'TYS-06', '77.650.912-4', 'San Diego 890, Santiago',           null,                       'contacto@textilessub.example',   null,                              '+56 2 2666 6060', '+56 9 7654 3210', null,                                                                  'Poleras y tazas en blanco por mayor.'),
  ('Ferretería El Tornillo',              'FET-07', '76.720.445-2', 'Av. Matta 1150, Santiago',          null,                       'ventas@eltornillo.example',      null,                              '+56 2 2888 7070', null,              null,                                                                  null),
  ('Tecnologías Andes SpA',               'TAN-08', '76.881.030-6', 'Providencia 2255, of. 304',         null,                       'ventas@tecnoandes.example',      'facturas@tecnoandes.example',     '+56 2 2999 8080', null,              'Banco BCI, cta. cte. 77889900',                                       null),
  ('Acrílicos y Plásticos Norte',         null,     '76.145.987-0', 'Av. Recoleta 3300',                 null,                       null,                             null,                              null,              null,              null,                                                                  null),
  ('Importadora Láser Asia Ltda.',        'ILA-10', '77.032.664-9', 'Av. Independencia 2050, Independencia', null,                   'info@laserasia.example',         null,                              '+56 2 2333 9090', '+56 9 6543 2109', 'Banco Itaú, cta. cte. 11223344',                                      'Repuestos láser y objetos para personalizar.'),
  ('Librería Mayorista Central',          'LMC-11', '76.410.256-7', 'Av. Santa Rosa 480, Santiago',      null,                       'ventas@libreriacentral.example', null,                              '+56 2 2111 1212', null,              null,                                                                  'Cuadernos, papelería y artículos de venta directa.'),
  ('Servicios Generales Pérez',           null,     '12.345.678-5', null,                                null,                       null,                             null,                              null,              null,              null,                                                                  null);

-- -----------------------------------------------------------------------------
-- Insumos Okima (cat = comienzo del nombre de la categoría; sub = subcategoría)
-- Algunos sin código; venta directa solo en los que se revenden tal cual.
-- -----------------------------------------------------------------------------
insert into insumos (nombre, id_subcategoria, codigo, ancho, alto, profundidad, venta_directa, precio_venta, qty)
select v.nombre, s.id, v.codigo, v.ancho::numeric, v.alto::numeric, v.prof::numeric, v.vd::boolean, v.pv::numeric, v.qty::numeric
from (values
  -- nombre, cat, sub, código, ancho, alto, prof, venta directa, precio venta, stock inicial
  ('Vinil adhesivo blanco brillante rollo 1,37 m',   'IMPRESIÓN GRAN',     'Roland SG300',                          'VIN-001', 1370,  null, null, false, null,  4),
  ('Vinil adhesivo transparente rollo 1,37 m',       'IMPRESIÓN GRAN',     'Roland SG300',                          'VIN-002', 1370,  null, null, false, null,  2),
  ('Tinta Eco-Sol Max cyan 220 ml',                  'IMPRESIÓN GRAN',     'Roland SG300',                          'TIN-101', null,  null, null, false, null,  6),
  ('Tinta Eco-Sol Max magenta 220 ml',               'IMPRESIÓN GRAN',     'Roland SG300',                          'TIN-102', null,  null, null, false, null,  5),
  ('Tinta Eco-Sol Max amarillo 220 ml',              'IMPRESIÓN GRAN',     'Roland SG300',                          'TIN-103', null,  null, null, false, null,  5),
  ('Tinta Eco-Sol Max negro 220 ml',                 'IMPRESIÓN GRAN',     'Roland SG300',                          'TIN-104', null,  null, null, false, null,  8),
  ('Cartucho de limpieza Roland SG300',              'IMPRESIÓN GRAN',     'Roland SG300',                          null,      null,  null, null, null,  null,  3),
  ('Lona frontlit 13 oz rollo 1,60 m',               'IMPRESIÓN GRAN',     'Roland RF640',                          'LON-010', 1600,  null, null, false, null,  3),
  ('Botella de tinta Roland RF640 negro 1 L',        'IMPRESIÓN GRAN',     'Roland RF640',                          'TIN-201', null,  null, null, false, null,  2),
  ('Papel fotográfico gran formato rollo 1,06 m',    'IMPRESIÓN GRAN',     'HP LATEX 335',                          null,      1060,  null, null, null,  null,  2),
  ('Cartucho HP Latex 831 negro 775 ml',             'IMPRESIÓN GRAN',     'HP LATEX 335',                          'TIN-301', null,  null, null, false, null,  4),
  ('Plancha de foam 5 mm 1,22 x 2,44 m',             'IMPRESIÓN GRAN',     'Sustratos Rígidos',                     'FOA-005', 1220,  2440, 5,    false, null, 25),
  ('Sintra 3 mm 1,22 x 2,44 m',                      'IMPRESIÓN GRAN',     'Sustratos Rígidos',                     'SIN-003', 1220,  2440, 3,    false, null, 18),
  ('Acrílico transparente 3 mm 1,22 x 2,44 m',       'IMPRESIÓN GRAN',     'Sustratos Rígidos',                     null,      1220,  2440, 3,    null,  null,  6),
  ('Laminado brillante rollo 1,37 m',                'IMPRESIÓN GRAN',     'Laminadora en Caliente (Gran Formato)', 'LAM-011', 1370,  null, null, false, null,  3),
  ('Laminado mate frío rollo 1,37 m',                'IMPRESIÓN GRAN',     'Laminadora en Frío',                    'LAM-012', 1370,  null, null, false, null,  2),
  ('Cabezal de impresión Roland SG300',              'IMPRESIÓN GRAN',     'Mantención de Máquinas y Repuestos',    null,      null,  null, null, null,  null,  1),
  ('Papel couché 150 g carta resma 500 hojas',       'IMPRESIÓN DIGITAL',  'Canon imagePRESS C700',                 'PAP-150', 216,   279,  null, true,  6500, 30),
  ('Papel couché 300 g SRA3 paquete 250 hojas',      'IMPRESIÓN DIGITAL',  'Canon imagePRESS C700',                 'PAP-300', 320,   450,  null, false, null, 12),
  ('Papel bond 75 g carta resma 500 hojas',          'IMPRESIÓN DIGITAL',  'Ricoh Aficio 5054',                     'BON-075', 216,   279,  null, true,  4500, 40),
  ('Papel bond 75 g oficio resma 500 hojas',         'IMPRESIÓN DIGITAL',  'Ricoh Aficio 5054',                     'BON-076', 216,   330,  null, true,  5200, 22),
  ('Tóner Canon C-EXV negro',                        'IMPRESIÓN DIGITAL',  'Canon imagePRESS C700',                 'TON-401', null,  null, null, false, null,  3),
  ('Tóner Canon C-EXV cyan',                         'IMPRESIÓN DIGITAL',  'Canon imagePRESS C700',                 'TON-402', null,  null, null, false, null,  2),
  ('Tóner Ricoh Aficio 5054 negro',                  'IMPRESIÓN DIGITAL',  'Ricoh Aficio 5054',                     null,      null,  null, null, null,  null,  4),
  ('Cartón piedra 2 mm pliego 100 x 70 cm',          'IMPRESIÓN DIGITAL',  'Encuadernación y Soportes',             'CAR-002', 1000,  700,  2,    false, null, 60),
  ('Cinta fastback 30 mm',                           'IMPRESIÓN DIGITAL',  'Encuadernación y Soportes',             null,      null,  null, null, null,  null, 10),
  ('Micas para plastificar carta 125 micras (caja 100)', 'IMPRESIÓN DIGITAL', 'Plastificadora',                      'MIC-125', 216,   303,  null, false, null,  9),
  ('Polimate rollo 0,63 m',                          'IMPRESIÓN DIGITAL',  'Laminadora en Caliente (Polimate)',     null,      630,   null, null, null,  null,  2),
  ('Fusor Ricoh Aficio 5054',                        'IMPRESIÓN DIGITAL',  'Mantención de Máquinas y Repuestos',    null,      null,  null, null, null,  null,  1),
  ('Tinta UV Roland LEF12 cyan',                     'IMPRESIÓN DIRECTA',  'Roland VersaUV LEF12',                  'UV-001',  null,  null, null, false, null,  3),
  ('Llaveros de acrílico en blanco (paquete 50)',    'IMPRESIÓN DIRECTA',  'Objetos para personalizar',             'LLA-050', 50,    30,   3,    false, null, 14),
  ('Lápices grabables (caja 50)',                    'IMPRESIÓN DIRECTA',  'Objetos para personalizar',             null,      null,  null, null, true,  9990, 20),
  ('Lamicoid 1,6 mm plancha 30 x 60 cm',             'IMPRESIÓN DIRECTA',  'Sustratos rígidos especiales',          'LAM-016', 300,   600,  1.6,  false, null,  7),
  ('Tubo láser CO2 60 W',                            'IMPRESIÓN DIRECTA',  'Mantención de Máquinas y Repuestos',    null,      null,  null, null, null,  null,  1),
  ('Moldura de pino 20 mm barra 2,4 m',              'MARQUETERÍA',        'Insumos de Enmarcado',                  'MOL-020', 20,    30,   2400, false, null, 80),
  ('Vidrio claro 2 mm (m²)',                         'MARQUETERÍA',        'Insumos de Enmarcado',                  null,      null,  null, null, null,  null, 12.5),
  ('Passepartout cartulina blanca pliego',           'MARQUETERÍA',        'Insumos de Enmarcado',                  'PAS-001', 800,   1100, null, false, null, 35),
  ('Puntas auxiliares (caja)',                       'MARQUETERÍA',        'Materiales Auxiliares',                 null,      null,  null, null, null,  null,  6),
  ('Cola fría 1 kg',                                 'MARQUETERÍA',        'Materiales Auxiliares',                 'COL-001', null,  null, null, false, null,  4),
  ('Cuchillo para ensambladora de marcos',           'MARQUETERÍA',        'Mantención de Máquinas y Repuestos',    null,      null,  null, null, null,  null,  2),
  ('Papel de sublimación A4 (paquete 100)',          'SUBLIMACIÓN',        'Insumos de Impresión',                  'SUB-A4',  210,   297,  null, false, null, 15),
  ('Tinta de sublimación 100 ml',                    'SUBLIMACIÓN',        'Insumos de Impresión',                  null,      null,  null, null, null,  null,  8),
  ('Polera poliéster blanca talla M',                'SUBLIMACIÓN',        'Sustratos en Blanco (Blanks)',          'POL-M',   null,  null, null, true,  6990, 45),
  ('Taza sublimable blanca 11 oz',                   'SUBLIMACIÓN',        'Sustratos en Blanco (Blanks)',          'TAZ-11',  null,  null, null, true,  3500, 96),
  ('Resistencia para plancha térmica',               'SUBLIMACIÓN',        'Mantención de Máquinas y Repuestos',    null,      null,  null, null, null,  null,  2),
  ('Papel fotográfico rollo 10 cm brillante',        'FOTOGRAFÍA',         'Papel Fotográfico',                     'FOT-10B', 100,   null, null, false, null,  6),
  ('Revelador para minilab (kit)',                   'FOTOGRAFÍA',         'Procesos Químicos',                     'QUI-REV', null,  null, null, false, null,  5),
  ('Filtro de recirculación minilab',                'FOTOGRAFÍA',         'Mantención Minilab y Repuestos',        null,      null,  null, null, null,  null,  2),
  ('Cuaderno tapa dura A5 100 hojas',                'TIENDA',             'Venta Directa',                         'CUA-A5',  148,   210,  12,   true,  4990, 50),
  ('Cinta adhesiva transparente 48 mm',              'TIENDA',             'Venta Directa',                         'SCO-48',  48,    null, null, true,  1490, 120),
  ('Mochila escolar reforzada',                      'TIENDA',             'Venta Directa',                         null,      null,  null, null, true,  24990, 18),
  ('Cutter 18 mm',                                   'HERRAMIENTAS',       'Herramientas de Uso General',           'CUT-18',  null,  null, null, false, null, 15),
  ('Regla metálica 1 m',                             'HERRAMIENTAS',       'Herramientas de Uso General',           null,      null,  null, null, null,  null,  6),
  ('Notebook para oficina',                          'INVERSIONES',        'Tecnología y Sistemas',                 null,      null,  null, null, null,  null,  0),
  ('Pintura látex blanca (4 galones)',               'INVERSIONES',        'Infraestructura y Remodelaciones',      null,      null,  null, null, null,  null,  1),
  ('Papel higiénico (pack 24)',                      'GASTOS',             'Operación de Oficina',                  'OFI-PH',  null,  null, null, false, null,  8),
  ('Detergente y cloro (pack aseo)',                 'GASTOS',             'Operación de Oficina',                  null,      null,  null, null, null,  null,  3)
) as v (nombre, cat, sub, codigo, ancho, alto, prof, vd, pv, qty)
join categorias c on starts_with(c.nombre, v.cat)
join subcategorias s on s.id_categoria = c.id and s.nombre = v.sub;

-- -----------------------------------------------------------------------------
-- Insumos de proveedor. Cada insumo Okima tiene una entrada en su proveedor
-- principal (la mayoría vinculada) y, en los pares, otra en uno secundario.
-- Las entradas sin vincular alimentan la vista "insumos por vincular".
-- -----------------------------------------------------------------------------
create temp table tmp_asignacion on commit drop as
select
  i.id,
  i.nombre,
  row_number() over (order by i.nombre) as n,
  m.p1,
  m.p2
from insumos i
join subcategorias s on s.id = i.id_subcategoria
join categorias c on c.id = s.id_categoria
join (values
  ('IMPRESIÓN GRAN',    'Insumos Plotter Chile S.A.',        'Acrílicos y Plásticos Norte'),
  ('IMPRESIÓN DIGITAL', 'Papelera Andina SpA',               'Distribuidora Gráfica Sur Ltda.'),
  ('IMPRESIÓN DIRECTA', 'Importadora Láser Asia Ltda.',      'Acrílicos y Plásticos Norte'),
  ('MARQUETERÍA',       'Marquetería Valdivia',              'Ferretería El Tornillo'),
  ('SUBLIMACIÓN',       'Textiles y Sublimados Ltda.',       'Importadora Láser Asia Ltda.'),
  ('FOTOGRAFÍA',        'Químicos Fotográficos del Pacífico','Distribuidora Gráfica Sur Ltda.'),
  ('TIENDA',            'Librería Mayorista Central',        'Importadora Láser Asia Ltda.'),
  ('HERRAMIENTAS',      'Ferretería El Tornillo',            'Librería Mayorista Central'),
  ('INVERSIONES',       'Tecnologías Andes SpA',             'Ferretería El Tornillo'),
  ('GASTOS',            'Librería Mayorista Central',        'Servicios Generales Pérez')
) as m (pref, p1, p2) on starts_with(c.nombre, m.pref);

-- Entrada principal: vinculada salvo cada quinto insumo; cada novena sin precio.
insert into insumos_proveedores
  (id_insumo_okima, nombre, codigo, id_proveedor, precio_clp, ancho, alto, cantidad_formato, formato_unidad, fecha_actualizacion, link_insumo)
select
  case when a.n % 5 = 0 then null else a.id end,
  a.nombre,
  case when a.n % 3 = 0 then null else 'P1-' || lpad(a.n::text, 3, '0') end,
  p.id,
  case when a.n % 9 = 0 then null else round((1500 + random() * 70000) / 10) * 10 end,
  null,
  null,
  case when a.n % 11 = 0 then null else (array[1, 1, 1, 6, 10, 12, 50, 100, 2.5])[1 + a.n % 9] end,
  case when a.n % 11 = 0 then null else (array['unidad', 'unidad', 'rollo', 'caja', 'paquete', 'resma', 'pack', 'botella', 'rollo'])[1 + a.n % 9] end,
  case when a.n % 9 = 0 then null else current_date - floor(random() * 180)::int end,
  case when a.n % 4 = 0 then 'https://ejemplo.cl/producto/' || a.n else null end
from tmp_asignacion a
join proveedores p on p.nombre = a.p1;

-- Entrada secundaria (solo en los pares): vinculada salvo cada tercero.
insert into insumos_proveedores
  (id_insumo_okima, nombre, codigo, id_proveedor, precio_clp, cantidad_formato, formato_unidad, fecha_actualizacion, descripcion)
select
  case when a.n % 3 = 0 then null else a.id end,
  a.nombre || ' (formato mayorista)',
  'P2-' || lpad(a.n::text, 3, '0'),
  p.id,
  round((1200 + random() * 65000) / 10) * 10,
  (array[1, 6, 12, 24, 100])[1 + a.n % 5],
  (array['unidad', 'caja', 'caja', 'pack', 'paquete'])[1 + a.n % 5],
  current_date - floor(random() * 120)::int,
  case when a.n % 4 = 0 then 'Precio válido hasta agotar stock.' else null end
from tmp_asignacion a
join proveedores p on p.nombre = a.p2
where a.n % 2 = 0;

-- Entradas sueltas, sin vincular a ningún insumo Okima.
insert into insumos_proveedores (nombre, id_proveedor, precio_clp, formato_unidad, fecha_actualizacion)
select v.nombre, p.id, v.precio::numeric, v.formato, current_date - v.dias
from (values
  ('Cinta doble contacto 12 mm',            'Ferretería El Tornillo',       1290,  'unidad',   10),
  ('Silicona neutra cartucho',              'Ferretería El Tornillo',       3490,  'unidad',   35),
  ('Papel kraft rollo 1 m',                 'Papelera Andina SpA',         18900,  'rollo',    20),
  ('Sobres manila oficio (caja 250)',       'Librería Mayorista Central',  12500,  'caja',     50),
  ('Bolsas de basura 80 x 110 (paquete 10)','Servicios Generales Pérez',    4200,  'paquete',  15),
  ('Servicio de aseo mensual',              'Servicios Generales Pérez',    null,  null,        5),
  ('Mouse inalámbrico',                     'Tecnologías Andes SpA',        9990,  'unidad',   40),
  ('Switch de red 8 puertos',               'Tecnologías Andes SpA',       24990,  'unidad',   40),
  ('Cartulina hilada A4 (paquete 100)',     'Papelera Andina SpA',          null,  'paquete',  70),
  ('Lámina PET transparente 0,5 mm',        'Acrílicos y Plásticos Norte',  null,  null,       25)
) as v (nombre, proveedor, precio, formato, dias)
join proveedores p on p.nombre = v.proveedor;

-- -----------------------------------------------------------------------------
-- Solicitudes de compra: 50 sobre insumos al azar, creadas en los últimos 60 días.
-- Pendientes ~78 %, compradas a mano ~10 %, canceladas ~12 %. Más abajo, algunas
-- pendientes se asocian a líneas de factura y el trigger las pasa a 'Comprada'.
-- -----------------------------------------------------------------------------
insert into solicitudes_compra
  (created_at, solicitante, id_insumo_okima, cantidad_solicitada, nivel_urgencia, fecha_esperada, estado)
select
  now() - random() * interval '60 days',
  (array['María González', 'Pedro Soto', 'Camila Rojas', 'Juan Pérez', 'Andrea Muñoz', 'Diego Fuentes'])[1 + floor(random() * 6)::int],
  x.id_insumo,
  case when x.g % 7 = 0 then 2.5 else 1 + floor(random() * 20) end,
  (array['Baja', 'Media', 'Media', 'Alta'])[1 + floor(random() * 4)::int]::nivel_urgencia,
  case when random() < 0.75 then current_date + (floor(random() * 30) - 8)::int end,
  case when x.r < 0.78 then 'Pendiente' when x.r < 0.88 then 'Comprada' else 'Cancelada' end
from (
  select g, i.id as id_insumo, random() as r
  from generate_series(1, 50) g
  cross join lateral (select id from insumos where g > 0 order by random() limit 1) i  -- g > 0 fuerza un insumo distinto por fila
) x;

-- -----------------------------------------------------------------------------
-- Facturas: 26, repartidas entre los proveedores con catálogo, hasta 6 meses atrás.
-- Se crean con totales en 0 y se recalculan cuando ya están las líneas.
-- -----------------------------------------------------------------------------
insert into facturas (id_proveedor, numero_factura, fecha, descuento_pct)
select
  p.id,
  (10000 + k * 37 + p.rn)::text,
  current_date - (k * 6 + floor(random() * 4))::int,
  case when k % 7 = 0 then 10 when k % 5 = 0 then 5 else 0 end
from generate_series(1, 26) k
join (
  select
    id,
    row_number() over (order by nombre) as rn,
    count(*) over () as cnt
  from proveedores pr
  where exists (select 1 from insumos_proveedores ip where ip.id_proveedor = pr.id)
) p on p.rn = 1 + (k % p.cnt);

-- Líneas: entre 2 y 6 por factura, del catálogo de su proveedor; ~1 de cada 4 con
-- descuento (5–15 %). subtotal = round(cantidad × precio × (1 − descuento / 100)).
insert into detalle_facturas (id_factura, id_insumo_proveedor, cantidad, precio_neto, descuento_pct, subtotal)
select id_factura, id_ip, cantidad, precio, pct, round(cantidad * precio * (1 - pct / 100.0))
from (
  select
    f.id as id_factura,
    ip.id as id_ip,
    1 + floor(random() * 10) as cantidad,
    round(coalesce(ip.precio_clp, 5000) * (0.92 + random() * 0.16)) as precio,
    (array[0, 0, 0, 5, 10, 15])[1 + floor(random() * 6)::int] as pct
  from facturas f
  cross join lateral (
    select ip2.*, row_number() over (order by random()) as rn
    from insumos_proveedores ip2
    where ip2.id_proveedor = f.id_proveedor
  ) ip
  where ip.rn <= 2 + abs(hashtext(f.id::text)) % 5
) l;

-- Líneas asociadas a solicitudes pendientes (hasta 9): el insumo de proveedor es
-- uno vinculado al insumo de la solicitud, en una factura de ese mismo proveedor.
-- El trigger marca esas solicitudes como 'Comprada'.
insert into detalle_facturas (id_factura, id_insumo_proveedor, id_solicitud_compra, cantidad, precio_neto, descuento_pct, subtotal)
select fid, ipid, sid, cant, precio, 0, round(cant * precio)
from (
  select
    s.id as sid,
    s.cantidad_solicitada as cant,
    ip.id as ipid,
    coalesce(ip.precio_clp, 5000) as precio,
    f.id as fid,
    row_number() over (order by s.created_at) as rn
  from solicitudes_compra s
  join lateral (
    select ip2.* from insumos_proveedores ip2
    where ip2.id_insumo_okima = s.id_insumo_okima
    order by random() limit 1
  ) ip on true
  join lateral (
    select f2.id from facturas f2
    where f2.id_proveedor = ip.id_proveedor
    order by random() limit 1
  ) f on true
  where s.estado = 'Pendiente'
) c
where rn <= 9;

-- Totales de cada factura, con la misma fórmula que la interfaz:
-- neto = round(Σ subtotales × (1 − descuento / 100)); IVA = round(neto × 0,19).
update facturas f
set neto_total = t.neto,
    iva        = round(t.neto * 0.19),
    total      = t.neto + round(t.neto * 0.19)
from (
  select f2.id, round(coalesce(sum(d.subtotal), 0) * (1 - f2.descuento_pct / 100.0)) as neto
  from facturas f2
  left join detalle_facturas d on d.id_factura = f2.id
  group by f2.id, f2.descuento_pct
) t
where t.id = f.id;

-- -----------------------------------------------------------------------------
-- Plantillas de gasto recurrente (se crean las que falten; monto 0 → monto de prueba)
-- -----------------------------------------------------------------------------
insert into plantillas_gastos_recurrentes (nombre, id_subcategoria, monto_default)
select v.nombre, s.id, v.monto
from (values
  ('Arriendo',              'Infraestructura',      850000),
  ('Sueldos',               'Remuneraciones',      4200000),
  ('Pago IVA',              'Impuestos y Finanzas', 650000),
  ('Internet y telefonía',  'Infraestructura',       45990),
  ('Contabilidad externa',  'Impuestos y Finanzas', 180000)
) as v (nombre, subcategoria, monto)
join categorias c on c.nombre = 'GASTOS ADMINISTRATIVOS Y FIJOS'
join subcategorias s on s.id_categoria = c.id and s.nombre = v.subcategoria
where not exists (select 1 from plantillas_gastos_recurrentes p where p.nombre = v.nombre);

update plantillas_gastos_recurrentes
set monto_default = case nombre
  when 'Arriendo' then 850000
  when 'Sueldos'  then 4200000
  when 'Pago IVA' then 650000
end
where monto_default = 0 and nombre in ('Arriendo', 'Sueldos', 'Pago IVA');

-- -----------------------------------------------------------------------------
-- Otros gastos: 6 meses de gastos recurrentes desde las plantillas (el IVA y
-- internet varían un poco cada mes) y gastos sueltos, con y sin proveedor.
-- -----------------------------------------------------------------------------
insert into otros_gastos (concepto, id_subcategoria, id_plantilla_recurrente, monto, fecha, numero_documento)
select
  p.nombre,
  p.id_subcategoria,
  p.id,
  case
    when p.nombre in ('Pago IVA', 'Internet y telefonía') then round(p.monto_default * (0.75 + random() * 0.5) / 10) * 10
    else p.monto_default
  end,
  least((date_trunc('month', current_date) - (m || ' months')::interval)::date + 4, current_date),
  case when p.nombre = 'Arriendo' then 'REC-' || to_char(current_date - (m || ' months')::interval, 'YYYYMM') end
from generate_series(0, 5) m
join plantillas_gastos_recurrentes p
  on p.nombre in ('Arriendo', 'Sueldos', 'Pago IVA', 'Internet y telefonía', 'Contabilidad externa')
where p.nombre <> 'Contabilidad externa' or m % 2 = 0;

insert into otros_gastos (concepto, id_subcategoria, id_proveedor, monto, fecha, numero_documento, notas)
select v.concepto, s.id, p.id, v.monto, current_date - v.dias, v.documento, v.notas
from (values
  -- concepto, subcategoría, proveedor, monto, días atrás, documento, notas
  ('Artículos de aseo del mes',              'Operación de Oficina',            'Servicios Generales Pérez',     38900,   6, 'BOL-2201', null),
  ('Resma y útiles de oficina',              'Operación de Oficina',            'Librería Mayorista Central',    27450,  12, 'FAC-8841', null),
  ('Servicio de aseo mensual',               'Operación de Oficina',            'Servicios Generales Pérez',     85000,  15, 'BOL-2214', 'Incluye retiro de basura.'),
  ('Patente comercial (cuota)',              'Impuestos y Finanzas',            null,                           312000,  40, 'PAT-2026-1', null),
  ('Comisión mantención cuenta corriente',   'Impuestos y Finanzas',            null,                            14990,  22, null, null),
  ('Reparación cerradura bodega',            'Infraestructura',                 'Ferretería El Tornillo',        46800,  33, 'FAC-3302', null),
  ('Pintura y materiales para el local',     'Infraestructura y Remodelaciones','Ferretería El Tornillo',       189990,  55, 'FAC-3377', 'Repintado de la fachada.'),
  ('Estantería metálica para bodega',        'Infraestructura y Remodelaciones','Ferretería El Tornillo',       274900,  78, 'FAC-3410', null),
  ('Mouse y switch de red',                  'Tecnología y Sistemas',           'Tecnologías Andes SpA',         34980,  28, 'FAC-5120', null),
  ('Licencia de software de diseño (anual)', 'Tecnología y Sistemas',           null,                           229000,  90, 'INV-2026-88', 'Pagada en CLP.'),
  ('Notebook para oficina',                  'Tecnología y Sistemas',           'Tecnologías Andes SpA',        599990, 110, 'FAC-5188', 'Activo fijo.'),
  ('Set de destornilladores y alicates',     'Herramientas de Uso General',     'Ferretería El Tornillo',        42990,  18, 'FAC-3355', null),
  ('Flete de encomienda a regiones',         null,                              null,                            12500,   9, null, 'Sin centro de costo asignado.'),
  ('Almuerzo con proveedor',                 null,                              null,                            31200,   4, null, null)
) as v (concepto, subcategoria, proveedor, monto, dias, documento, notas)
left join subcategorias s on s.nombre = v.subcategoria
left join proveedores p on p.nombre = v.proveedor;

commit;

-- Resultado: filas cargadas en cada tabla.
select 'categorias' as tabla, count(*) as filas from categorias
union all select 'subcategorias', count(*) from subcategorias
union all select 'proveedores', count(*) from proveedores
union all select 'insumos', count(*) from insumos
union all select 'insumos_proveedores', count(*) from insumos_proveedores
union all select 'solicitudes_compra', count(*) from solicitudes_compra
union all select 'facturas', count(*) from facturas
union all select 'detalle_facturas', count(*) from detalle_facturas
union all select 'otros_gastos', count(*) from otros_gastos
union all select 'plantillas_gastos_recurrentes', count(*) from plantillas_gastos_recurrentes;
