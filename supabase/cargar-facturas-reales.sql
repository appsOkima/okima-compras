-- =============================================================================
-- Okima Compras — carga de facturas reales (desde la hoja de cálculo)
--
-- Ejecutar en el SQL Editor de Supabase, sobre una base con el schema.sql ya
-- cargado. Carga 50 facturas con sus 110 líneas de detalle, tomadas de
-- facturas.csv (hoja donde una sola tabla mezclaba cabecera y líneas: la fila con
-- N° de factura abre la factura y las filas siguientes, sin N°, son sus líneas).
--
-- Qué hace:
--   * Proveedores: reutiliza los que ya existen con el mismo nombre (sin distinguir
--     mayúsculas ni espacios extra); los que no existen los crea con
--     rut = 'POR COMPLETAR' (la hoja no trae RUT y la columna es obligatoria) y
--     sin código, así aparecen en el filtro "Incompletos" de Proveedores.
--   * Insumos de proveedor: uno por (proveedor, nombre del ítem), creados sin
--     vincular a un insumo Okima y sin precio (como la creación al vuelo). Quedan
--     en "Por vincular". Al no estar vinculados, esta carga NO mueve stock.
--   * Facturas: neto, IVA y total son los de la hoja (los de la factura real, no
--     recalculados); el descuento general va en descuento_pct.
--   * Líneas: cantidad, precio neto unitario, descuento del ítem (%) y total del
--     ítem (subtotal) tal como vienen en la hoja. No se asocian a solicitudes.
--
-- Supuestos sobre la hoja:
--   * Las fechas sin año (31-08, 7/9…) son de 2026; el formato es día/mes.
--   * 'Mundotransfer' y 'Mundo Transfer' se cargan como un solo proveedor
--     ('Mundo Transfer'). 'Moldur' y 'Moldur Vip' quedan como proveedores
--     distintos: si son el mismo, unifícalos a mano.
--   * Las facturas 68416 (Claroscuro, 11-06) y 48997 (Ditra, 27/06) traen fecha de
--     junio, fuera del rango agosto–septiembre del resto: se cargan tal cual.
--   * Unas pocas facturas tienen diferencias de pocos pesos entre la suma de sus
--     líneas (o un subtotal) y el neto de la hoja (redondeos del proveedor); se
--     respeta lo que dice la hoja.
--
-- No se ejecuta dos veces: si alguna factura (proveedor + número) ya existe, se
-- detiene sin cambiar nada. Para deshacer: borrar esas facturas (las líneas se
-- borran en cascada y el stock, si lo hubiera, se revierte por trigger).
-- =============================================================================

begin;

create temp table _fac (
  proveedor text, numero text, fecha date,
  descuento_pct numeric, neto numeric, iva numeric, total numeric
) on commit drop;

create temp table _lin (
  proveedor text, numero text, orden int, cantidad numeric, item text,
  precio_neto numeric, descuento_pct numeric, subtotal numeric
) on commit drop;

insert into _fac (proveedor, numero, fecha, descuento_pct, neto, iva, total) values
  ('Claroscuro', '70054', date '2026-08-31', 0, 12118, 2302, 14420),
  ('Moldur Vip', '22410', date '2026-08-31', 0, 24808, 4714, 29522),
  ('Fotomar', '71642', date '2026-08-31', 0, 464604, 88275, 552879),
  ('Walter Lund', '556309', date '2026-08-31', 0, 95250, 18098, 113348),
  ('Claroscuro', '68416', date '2026-06-11', 0, 20556, 3906, 24462),
  ('Mundo Transfer', '1190359', date '2026-09-02', 0, 9582, 1821, 11403),
  ('Mundo Transfer', '1190358', date '2026-09-02', 0, 10900, 2071, 12971),
  ('Ferreteria Leon XIII', '14893', date '2026-08-22', 0, 7891, 1499, 9390),
  ('Ditra', '48997', date '2026-06-27', 0, 14286, 2714, 17000),
  ('Microgeo', '8650', date '2026-09-11', 0, 297672, 56558, 354230),
  ('Inicio Computacion', '4567', date '2026-09-07', 0, 23277, 4423, 27700),
  ('Buron', '592', date '2026-08-03', 0, 225800, 42902, 268702),
  ('Walter Lund', '551186', date '2026-08-04', 0, 197348, 37496, 234844),
  ('Rigel', '5827', date '2026-08-05', 5, 29937, 5688, 35625),
  ('Walter Lund', '551664', date '2026-08-06', 0, 86874, 16506, 103380),
  ('Wiscot', '59020', date '2026-08-08', 0, 7563, 1437, 9000),
  ('Eugenio Sanguineti', '111804', date '2026-08-10', 0, 7387, 1404, 8791),
  ('Microgeo', '6242', date '2026-08-10', 0, 77945, 14810, 92755),
  ('Mundo Transfer', '1183747', date '2026-08-18', 0, 35455, 6736, 42191),
  ('Energlass', '26290', date '2026-08-18', 0, 14880, 2827, 17707),
  ('Blasco', '145816', date '2026-08-18', 0, 53785, 10219, 64004),
  ('Claroscuro', '69786', date '2026-08-18', 0, 33312, 6329, 39641),
  ('Matrix', '82186', date '2026-08-18', 0, 5900, 1121, 7021),
  ('Walter Lund', '553973', date '2026-08-18', 0, 4730, 899, 5629),
  ('Filter Graphic', '99714', date '2026-08-19', 0, 92046, 17489, 109535),
  ('Microgeo', '6984', date '2026-08-20', 0, 518000, 98420, 616420),
  ('Moldur', '22359', date '2026-08-20', 0, 35568, 6758, 42326),
  ('Neczo', '15918', date '2026-08-20', 0, 46300, 8797, 55097),
  ('Don Alvaro', '102140', date '2026-08-20', 0, 68723, 13057, 81780),
  ('Antalis', '1099566', date '2026-08-20', 0, 99900, 18981, 118881),
  ('Mundo Transfer', '1185342', date '2026-08-21', 0, 33525, 6370, 39895),
  ('Microgeo', '7111', date '2026-08-24', 0, 132912, 25253, 158165),
  ('Neczo', '15937', date '2026-08-28', 0, 30600, 5814, 36414),
  ('Soporte Publicitario', '185295', date '2026-08-28', 0, 659912, 125383, 785295),
  ('Soporte Publicitario', '185313', date '2026-08-28', 0, 53400, 10146, 63546),
  ('Walter Lund', '556314', date '2026-08-31', 0, 59817, 11365, 71182),
  ('Microgeo', '7805', date '2026-08-31', 0, 102216, 19421, 121637),
  ('Lider', '80463331', date '2026-08-29', 0, 26496, 5034, 31530),
  ('Fotomar', '71461', date '2026-09-01', 0, 1049261, 199360, 1248621),
  ('Inicio Computacion', '4575', date '2026-09-10', 0, 7395, 1405, 8800),
  ('Inicio Computacion', '4577', date '2026-09-10', 0, 4118, 782, 4900),
  ('Bruce Cuadros', '1851', date '2026-09-10', 0, 675000, 128250, 803250),
  ('Texbag', '97553', date '2026-09-14', 0, 62000, 11780, 73780),
  ('Junaplas', '1050732', date '2026-09-15', 3, 58703, 11154, 69857),
  ('Walter Lund', '559521', date '2026-09-16', 0, 79677, 15139, 94816),
  ('Microgeo', '9142', date '2026-09-22', 0, 215191, 40886, 256077),
  ('Walter Lund', '560405', date '2026-09-23', 0, 28405, 5397, 33802),
  ('Filter Graphic', '100325', date '2026-09-23', 0, 92046, 17489, 109535),
  ('Claroscuro', '70584', date '2026-09-24', 0, 34076, 6474, 40550),
  ('Mundo Transfer', '1199870', date '2026-09-24', 0, 6529, 1241, 7770);

insert into _lin (proveedor, numero, orden, cantidad, item, precio_neto, descuento_pct, subtotal) values
  ('Claroscuro', '70054', 1, 2, 'Moldura 3021-TIZA (30-21-01)', 6059, 0, 12118),
  ('Moldur Vip', '22410', 1, 4, 'Pqte de 100 Peinetas doradas marcos', 6202, 0, 24808),
  ('Fotomar', '71642', 1, 10, 'Papel Lucky Lustre 12,7x 183', 66372, 30, 464604),
  ('Walter Lund', '556309', 1, 20, 'Resmas oficio Excelent', 2520, 0, 50400),
  ('Walter Lund', '556309', 2, 15, 'Resmas carta Excelent', 2990, 0, 44850),
  ('Claroscuro', '68416', 1, 2, 'Moldura 207-NEGRO', 10278, 0, 20556),
  ('Mundo Transfer', '1190359', 1, 1, 'V.Deco Adhesivo 30.5cm/10m Gold', 9605, 0, 9605),
  ('Mundo Transfer', '1190358', 1, 25, 'Bolsa Sub. Th/Sellada Tirantes/Fuelle 30x40x15cm', 436, 0, 10900),
  ('Ferreteria Leon XIII', '14893', 1, 1, 'Mascarilla Cartucho Doble', 4958, 0, 4958),
  ('Ferreteria Leon XIII', '14893', 2, 1, 'Punta Phillips Truper', 1420, 0, 1420),
  ('Ferreteria Leon XIII', '14893', 3, 2, 'Punta Phillips Corta', 756, 0, 1513),
  ('Ditra', '48997', 1, 1, 'Afilado Cuchilla Guillotina 1/2', 14286, 0, 14286),
  ('Microgeo', '8650', 1, 1, 'Cartridge UV4 Roland LEF/LEJ/LEC3', 112098, 0, 112098),
  ('Microgeo', '8650', 2, 1, 'Cartridge UV4 Roland LEF/LEJ/LEC3', 112098, 0, 112098),
  ('Microgeo', '8650', 3, 1, 'Cartridge ECO_SOL MAX2 220', 73476, 0, 73476),
  ('Inicio Computacion', '4567', 1, 1, 'Teclado Philips', 7479, 0, 7479),
  ('Inicio Computacion', '4567', 2, 1, 'Teclado Tecmaster', 7479, 0, 7479),
  ('Inicio Computacion', '4567', 3, 1, 'Mouse HP', 8319, 0, 8319),
  ('Buron', '592', 1, 1, 'Cambio Ventilador y tarj a equipo estabilizador', 225800, 0, 225800),
  ('Walter Lund', '551186', 1, 1, 'couché opaco300 gr (72x102) 125 hjs TITAN', 31900, 0, 31900),
  ('Walter Lund', '551186', 2, 1, 'couché opaco 170 gr (72x102) 125 hjs TITAN', 17737, 0, 17737),
  ('Walter Lund', '551186', 3, 1, 'opalina lisa 250 grs 100 hjs 77x110', 53926, 0, 53926),
  ('Walter Lund', '551186', 4, 1, 'opalina tela 250 grs 100 hjs 110x77', 62932, 0, 62932),
  ('Walter Lund', '551186', 5, 1, 'bond oriental 90 gr (77x110) 250 hjs', 19353, 0, 19353),
  ('Walter Lund', '551186', 6, 5, 'corte de papel', 2300, 0, 11500),
  ('Rigel', '5827', 1, 6, 'Equipo Led 56 w 500LM 6500K 120cm empavonado', 5252, 0, 31512),
  ('Walter Lund', '551664', 1, 14, 'Cartón Piedra WL 3,0 mm 85x115', 1481, 0, 20734),
  ('Walter Lund', '551664', 2, 20, 'Excellent carta 21,6x27,9 75 gr (500 hjs)', 2520, 0, 50400),
  ('Walter Lund', '551664', 3, 14, 'Corte cartón Piedra', 130, 0, 1820),
  ('Walter Lund', '551664', 4, 6, 'Cartón Piedra base negra 1,68mm 77x110', 1870, 0, 11220),
  ('Walter Lund', '551664', 5, 6, 'corte cartón pieda', 450, 0, 2700),
  ('Wiscot', '59020', 1, 1, 'Maskin 48 mm 2"-40 mt', 2941, 0, 2941),
  ('Wiscot', '59020', 2, 1, 'Tarugo Fisher 6mm', 3193, 0, 3193),
  ('Wiscot', '59020', 3, 1, 'Broca 6mm concreto', 1428, 0, 1428),
  ('Eugenio Sanguineti', '111804', 1, 1, 'Productos varios', 7387, 0, 7387),
  ('Microgeo', '6242', 1, 1, 'Cartridge Cleaning TR2 Truevis TE', 77945, 0, 77945),
  ('Mundo Transfer', '1183747', 1, 2, 'V. Deco Adhesivo 30,5cm/10m Gold', 9605, 0, 19210),
  ('Mundo Transfer', '1183747', 2, 1, 'V. Deco Adhesivo 30,5cm/10m Royal', 9605, 0, 9605),
  ('Mundo Transfer', '1183747', 3, 10, 'Mouse Pad Sira 22x18x02 cm (100xbolsa)', 664, 0, 6640),
  ('Energlass', '26290', 1, 24, 'Distanciador 16x25 mm', 620, 0, 14880),
  ('Blasco', '145816', 1, 55, 'Boligrafo Bamboo Mod B22 Touch Screen P 50 1000', 349, 0, 19195),
  ('Blasco', '145816', 2, 55, 'Boligrafo modelo co10 color blanco P 50 1000', 138, 0, 7590),
  ('Blasco', '145816', 3, 2, 'Goma timbre ecoline verde sin olor A4', 13500, 0, 27000),
  ('Claroscuro', '69786', 1, 4, 'Moldura C/Folia T. oro 20-18-12 3.00mts', 8328, 0, 33312),
  ('Matrix', '82186', 1, 1, 'Lime Permanente 122 cm', 5900, 0, 5900),
  ('Walter Lund', '553973', 1, 5, 'Carton piedra WL 2,0 mm 77x110', 946, 0, 4730),
  ('Filter Graphic', '99714', 1, 2, 'Termolaminado Matte 33 x 152,4 mts 42 Mic', 46023, 0, 92046),
  ('Microgeo', '6984', 1, 1, 'Cartridge UV4 Roland LEF/LEJ/LEC3', 110075, 0, 110075),
  ('Microgeo', '6984', 2, 1, 'Cabezal Cyan/Black HP831 Latex 30', 164650, 0, 164650),
  ('Microgeo', '6984', 3, 1, 'Cabezal Yellow/Magenta HP831 Late', 164650, 0, 164650),
  ('Microgeo', '6984', 4, 1, 'Cartridge Cleaning TR2 Truevis TE', 78625, 0, 78625),
  ('Moldur', '22359', 1, 2, 'Passepartout Negro 100x120 cm', 9059, 0, 18118),
  ('Moldur', '22359', 2, 2.75, 'Moldura negra plana 20x34 Art.2118-49', 3615, 0, 9941),
  ('Moldur', '22359', 3, 2.7, 'Moldura plana 2x2 Negra Art.998-49', 2781, 0, 7509),
  ('Neczo', '15918', 1, 2, 'Anillos 22 Negros', 23150, 0, 46300),
  ('Don Alvaro', '102140', 1, 1, 'Taumm Combinacion Lavaplatos BONN', 30588, 0, 30588),
  ('Don Alvaro', '102140', 2, 2, 'Truper prensa esquinewra 3 no', 5294, 0, 10588),
  ('Don Alvaro', '102140', 3, 2, 'Ingco escuadra magnetica para soldador 3 25LBS no', 2495, 0, 4990),
  ('Don Alvaro', '102140', 4, 1, 'Imporper tornillo volc.R/gruesa zinc.6x1.5/8 x caja no', 1260, 0, 1260),
  ('Don Alvaro', '102140', 5, 1, 'Imporper tornillo volc.pta.broca 6x1,5/8 x caja no', 1588, 0, 1588),
  ('Don Alvaro', '102140', 6, 2, 'OFERTA A MIL', 840, 0, 1680),
  ('Don Alvaro', '102140', 7, 1, 'Truper cinta ducto 48mm x 30 mt no', 3991, 0, 3991),
  ('Don Alvaro', '102140', 8, 1, 'TOTAL set brtocas,metal, madera y multifuncion 16 pcs', 14033, 0, 14033),
  ('Antalis', '1099566', 1, 34, 'C,transferible 48mm x 40 mts Blanco 36R/C', 2500, 0, 85000),
  ('Antalis', '1099566', 2, 5, 'Fotocopia Report 75g (F) oficio 500 hjs', 2980, 0, 14900),
  ('Mundo Transfer', '1185342', 1, 75, 'Bolsa Sub. Costurada Tirantes 27x33 cm 25 u', 447, 0, 33525),
  ('Microgeo', '7111', 1, 1, 'Tinta Roland Truevis TE2 Black B', 66456, 0, 66456),
  ('Microgeo', '7111', 2, 1, 'Tinta Roland Truevis TE2 Yelow B', 66456, 0, 66456),
  ('Neczo', '15937', 1, 300, 'Espiral 8 mm', 42, 0, 12600),
  ('Neczo', '15937', 2, 100, 'Gofrada carta Nat', 95, 0, 9500),
  ('Neczo', '15937', 3, 100, 'Lisa carta Nat', 85, 0, 8500),
  ('Soporte Publicitario', '185295', 1, 10, 'Mastil curvo vela pro 220x70 cm (280 cms) p Bandera Pub', 11175, 20, 89400),
  ('Soporte Publicitario', '185295', 2, 10, 'Impresion 180x70 cm Bandera curva tela lisa 110 grs', 22050, 20, 176400),
  ('Soporte Publicitario', '185295', 3, 10, 'Base Pro x color negro (60 cm) bandera Publicitaria', 13688, 20, 109504),
  ('Soporte Publicitario', '185295', 4, 12, 'MT2 impresion en tela lisa 110 gr-1440 DPI sublimacion', 17500, 20, 168000),
  ('Soporte Publicitario', '185295', 5, 20, 'Bolsillo 5 cm (metro lineal) Sublimacion', 7288, 20, 116608),
  ('Soporte Publicitario', '185313', 1, 3, 'MT2 Impresion en tela Display 250 gr-1440 DPI Sublimac', 22250, 20, 53400),
  ('Walter Lund', '556314', 1, 1, 'Couché opaco 300 gr (72x102) 125 hjs TITAN', 31900, 0, 31900),
  ('Walter Lund', '556314', 2, 1, 'Corte couché -opalina- autoadhesivo', 2400, 0, 2400),
  ('Walter Lund', '556314', 3, 1, 'Couché opaco 170 gr (72x102) 125 hjs TITAN', 17737, 0, 17737),
  ('Walter Lund', '556314', 4, 1, 'Corte couché -opalina-autoadhesivo', 2400, 0, 2400),
  ('Walter Lund', '556314', 5, 5, 'Carton Piedra WL 2,0 mm 77x110', 946, 0, 4730),
  ('Walter Lund', '556314', 6, 5, 'Corte cartón piedra', 130, 0, 650),
  ('Microgeo', '7805', 1, 2, 'Vinilo Microsol 80 Matte p/ solv 1', 51108, 0, 102216),
  ('Lider', '80463331', 1, 1, 'compras varias de aseo', 26496, 0, 26496),
  ('Fotomar', '71461', 1, 4, 'Papel Fuji 12,7x86 mt LUSTRE/85710-5', 96372, 9, 350794),
  ('Fotomar', '71461', 2, 4, 'Papel Fuji 15,2x86 mt LUSTRE/85716-7', 115831, 9, 421625),
  ('Fotomar', '71461', 3, 2, 'Papel Fuji 30,5x124 mt LUSTRE', 152111, 9, 276845),
  ('Inicio Computacion', '4575', 1, 1, 'Cable de poder Rebol', 2436, 0, 2436),
  ('Inicio Computacion', '4575', 2, 1, 'Mouse Tecmaster', 4957, 0, 4957),
  ('Inicio Computacion', '4577', 1, 1, 'HUB usb philco', 4118, 0, 4118),
  ('Bruce Cuadros', '1851', 1, 1000, 'Molduras 13x16 pino (3M)', 675, 0, 675000),
  ('Texbag', '97553', 1, 10, 'Plancha PET/MICA Transparente 0,5 mm 1.22x2.44', 6200, 0, 62000),
  ('Junaplas', '1050732', 1, 4, 'Bolsa prepicado 35x50 P.E. Alta', 3500, 0, 14000),
  ('Junaplas', '1050732', 2, 4, 'Bolsa prepicado 25x35 P.E Alta', 3500, 0, 14000),
  ('Junaplas', '1050732', 3, 4, 'Bolsa prepicado 20x30 P.E Alta', 3500, 0, 14000),
  ('Junaplas', '1050732', 4, 50, 'Bolsa 90x110x0.008 PE Negro', 370, 0, 18519),
  ('Walter Lund', '559521', 1, 2, 'Couché opaco 300 gr (72x102) 125hjs Titan', 31900, 0, 63800),
  ('Walter Lund', '559521', 2, 2, 'Corte de papel', 2300, 0, 4600),
  ('Walter Lund', '559521', 3, 7, 'Cartón Piedra WL 3,0mm 85x115', 1481, 0, 10367),
  ('Walter Lund', '559521', 4, 7, 'Corte cartón piedra', 130, 0, 910),
  ('Microgeo', '9142', 1, 1, 'Vinilo Microsol Black Matte 0.61M', 18183, 0, 18183),
  ('Microgeo', '9142', 2, 1, 'Tinta Roland Truevis TE2 Cyan Bol', 68904, 0, 68904),
  ('Microgeo', '9142', 3, 1, 'Tinta Roland Truevis TE2 Magenta Bol', 68904, 0, 68904),
  ('Microgeo', '9142', 4, 1, 'Tinta Nutec E12 p/Roland Magenta', 59200, 0, 59200),
  ('Walter Lund', '560405', 1, 1, 'Ahuesado 80 grs 250 hjs (77x110)', 21937, 0, 21937),
  ('Walter Lund', '560405', 2, 2, 'Papel de color ahuesado carta', 3234, 0, 6468),
  ('Filter Graphic', '100325', 1, 2, 'Termolaminado Matte 33 x 152,4 mts 42 Mic', 46023, 0, 92046),
  ('Claroscuro', '70584', 1, 2, 'Moldura C/Folia 5040 F-Bronce 3.00 mts', 17038, 0, 34076),
  ('Mundo Transfer', '1199870', 1, 3, 'Dogo Premium Negro TXL', 2176, 0, 6528);

-- Un solo criterio de "mismo nombre" para proveedores e ítems.
create or replace function pg_temp.clave(t text) returns text
language sql immutable as $$ select lower(btrim(regexp_replace(t, '\s+', ' ', 'g'))) $$;

do $$
declare
  repetidas text;
  ambiguos text;
begin
  select string_agg(f.proveedor || ' ' || f.numero, ', ') into repetidas
  from _fac f
  join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(f.proveedor)
  join facturas x on x.id_proveedor = p.id and x.numero_factura = f.numero;
  if repetidas is not null then
    raise exception 'Estas facturas ya existen y no se vuelven a cargar: %', repetidas;
  end if;

  select string_agg(nombre, ', ') into ambiguos
  from (
    select min(nombre) as nombre
    from proveedores
    where pg_temp.clave(nombre) in (select pg_temp.clave(proveedor) from _fac)
    group by pg_temp.clave(nombre)
    having count(*) > 1
  ) t;
  if ambiguos is not null then
    raise exception 'Hay proveedores repetidos con el mismo nombre (%). Unifícalos antes de cargar.', ambiguos;
  end if;
end
$$;

-- Proveedores nuevos.
insert into proveedores (nombre, rut)
select p.nombre, 'POR COMPLETAR'
from (
  select distinct on (pg_temp.clave(proveedor)) proveedor as nombre
  from _fac
  order by pg_temp.clave(proveedor), proveedor
) p
where not exists (select 1 from proveedores x where pg_temp.clave(x.nombre) = pg_temp.clave(p.nombre));

-- Insumos de proveedor nuevos (sin vincular).
insert into insumos_proveedores (nombre, id_proveedor)
select i.item, p.id
from (
  select distinct on (pg_temp.clave(proveedor), pg_temp.clave(item)) proveedor, item
  from _lin
  order by pg_temp.clave(proveedor), pg_temp.clave(item), orden
) i
join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(i.proveedor)
where not exists (
  select 1 from insumos_proveedores x
  where x.id_proveedor = p.id and pg_temp.clave(x.nombre) = pg_temp.clave(i.item)
);

-- Facturas (cabeceras).
insert into facturas (id_proveedor, numero_factura, fecha, descuento_pct, neto_total, iva, total)
select p.id, f.numero, f.fecha, f.descuento_pct, f.neto, f.iva, f.total
from _fac f
join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(f.proveedor);

-- Líneas. created_at escalonado por milisegundos para conservar el orden de la hoja.
insert into detalle_facturas (created_at, id_factura, id_insumo_proveedor, cantidad, precio_neto, descuento_pct, subtotal)
select now() + l.orden * interval '1 millisecond', fa.id, ip.id, l.cantidad, l.precio_neto, l.descuento_pct, l.subtotal
from _lin l
join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(l.proveedor)
join facturas fa on fa.id_proveedor = p.id and fa.numero_factura = l.numero
join insumos_proveedores ip on ip.id_proveedor = p.id and pg_temp.clave(ip.nombre) = pg_temp.clave(l.item);

-- Control: deben haberse cargado todas las facturas y líneas del archivo.
do $$
declare
  n_fac int;
  n_lin int;
begin
  select count(*) into n_fac
  from _fac f
  join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(f.proveedor)
  join facturas x on x.id_proveedor = p.id and x.numero_factura = f.numero;

  select count(*) into n_lin
  from _fac f
  join proveedores p on pg_temp.clave(p.nombre) = pg_temp.clave(f.proveedor)
  join facturas x on x.id_proveedor = p.id and x.numero_factura = f.numero
  join detalle_facturas d on d.id_factura = x.id;

  if n_fac <> 50 or n_lin <> 110 then
    raise exception 'Se esperaban 50 facturas y 110 líneas, pero quedaron % y %. No se guardó nada.', n_fac, n_lin;
  end if;
end
$$;

commit;

-- Resultado.
select 'proveedores' as tabla, count(*) as filas from proveedores
union all select 'insumos_proveedores', count(*) from insumos_proveedores
union all select 'facturas', count(*) from facturas
union all select 'detalle_facturas', count(*) from detalle_facturas;
