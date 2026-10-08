-- Sprint 2 / T3b: pruebas de las políticas por rol (2026-10-02-11-rls-por-rol.sql).
-- Actualizado a la migración 13 (boletas sin concepto ni insumos del proveedor): las boletas se insertan sin
-- `concepto`, las líneas de boleta no usan id_insumo_proveedor y las boletas ya no generan movimientos
-- de stock. Siguen siendo 143 casos (la numeración no cambia: ninguno probaba stock de boletas).
-- NO DEJA CAMBIOS en la base: las filas de prueba se crean y se usan dentro de un sub-bloque
-- (BEGIN ... EXCEPTION) de un DO que termina con una excepción propia (P0777); Postgres revierte
-- todo el sub-bloque y los resultados sobreviven en una variable del DO. No necesita BEGIN/ROLLBACK
-- explícitos (que, si el SELECT final va después del ROLLBACK, perderían los resultados) y no deja
-- ninguna transacción abierta. Lo único que persiste son dos tablas TEMPORALES de esta sesión.
-- Ejecutar el archivo completo en el SQL Editor: el último (y único) resultado es la tabla final
-- con columnas orden, rol, prueba, esperado, obtenido, ok, detalle. La fila orden 0 resume.
--
-- Simulación de roles: set local role authenticated + request.jwt.claims con el uuid del usuario de
-- ejemplo (richard@okima.cl productor, gerardo@okima.cl contador, tac@okima.cl admin), buscado en
-- auth.users. Si un usuario no existe o su perfil no tiene el rol esperado, esas pruebas se omiten
-- (ok = null, obtenido = 'omitida'). Además se prueban: anon (sin jwt), y un usuario autenticado
-- sin perfil (uuid aleatorio). Usa SOLO esas filas de prueba (uuid aaaaaaaa-aaaa-4aaa-8aaa-...).
--
-- Lectura de resultados: 'filas=N' = filas afectadas (UPDATE/DELETE denegados por RLS afectan 0
-- filas SIN error; el INSERT denegado da 'error 42501'); un número = resultado de un count.
-- Requiere que 2026-10-02-11-rls-por-rol.sql ya esté aplicada (si no, las pruebas de denegación
-- fallarán, lo que sirve para ver el estado permisivo).

drop table if exists pg_temp.resultados;
create temp table resultados (
  orden     integer,
  rol       text,
  prueba    text,
  esperado  text,
  obtenido  text,
  ok        boolean,
  detalle   text
);

do $prueba$
declare
  v_casos   jsonb;
  v_res     jsonb := '[]'::jsonb;
  v_uid_p   uuid;  v_uid_c uuid;  v_uid_a uuid;
  v_ok_p    boolean := false;  v_ok_c boolean := false;  v_ok_a boolean := false;
  v_perfil  text;
  i         integer;
  c         jsonb;
  v_rol     text;
  v_uid     uuid;
  v_habil   boolean;
  v_tipo    text;
  v_sql     text;
  v_esp     text;
  v_txt     text;
  v_n       bigint;
  v_obt     text;
  v_msg     text;
  v_pasa    boolean;
  v_residuos bigint;
begin
  -- Usuarios de ejemplo y verificación de su perfil.
  select id into v_uid_p from auth.users where email = 'richard@okima.cl';
  select id into v_uid_c from auth.users where email = 'gerardo@okima.cl';
  select id into v_uid_a from auth.users where email = 'tac@okima.cl';

  v_perfil := null;
  if v_uid_p is null then
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','productor','prueba','usuario richard@okima.cl existe','esperado','existe','obtenido','NO existe en auth.users: se omiten sus pruebas','ok',false));
  else
    select rol::text into v_perfil from public.perfiles where id = v_uid_p;
    v_ok_p := v_perfil = 'productor';
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','productor','prueba','perfil de richard@okima.cl','esperado','productor','obtenido',coalesce(v_perfil,'sin perfil'),'ok',v_ok_p));
  end if;

  v_perfil := null;
  if v_uid_c is null then
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','contador','prueba','usuario gerardo@okima.cl existe','esperado','existe','obtenido','NO existe en auth.users: se omiten sus pruebas','ok',false));
  else
    select rol::text into v_perfil from public.perfiles where id = v_uid_c;
    v_ok_c := v_perfil = 'contador';
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','contador','prueba','perfil de gerardo@okima.cl','esperado','contador','obtenido',coalesce(v_perfil,'sin perfil'),'ok',v_ok_c));
  end if;

  v_perfil := null;
  if v_uid_a is null then
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','admin','prueba','usuario tac@okima.cl existe','esperado','existe','obtenido','NO existe en auth.users: se omiten sus pruebas','ok',false));
  else
    select rol::text into v_perfil from public.perfiles where id = v_uid_a;
    v_ok_a := v_perfil = 'admin';
    v_res := v_res || jsonb_build_array(jsonb_build_object('rol','admin','prueba','perfil de tac@okima.cl','esperado','admin','obtenido',coalesce(v_perfil,'sin perfil'),'ok',v_ok_a));
  end if;

  select jsonb_agg(jsonb_build_array(rol, prueba, tipo, sql, esperado) order by n) into v_casos
  from (
    values
      (1, 'productor', $q$lee proveedores$q$, 'q', $q$select count(*) from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, '1'),
      (2, 'productor', $q$lee insumos_proveedores$q$, 'q', $q$select count(*) from public.insumos_proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006'$q$, '1'),
      (3, 'productor', $q$lee insumos$q$, 'q', $q$select count(*) from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$q$, '1'),
      (4, 'productor', $q$lee insumos_proveedores_okima$q$, 'q', $q$select count(*) from public.insumos_proveedores_okima where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'$q$, '1'),
      (5, 'productor', $q$lee categorias$q$, 'q', $q$select count(*) from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, '1'),
      (6, 'productor', $q$lee subcategorias$q$, 'q', $q$select count(*) from public.subcategorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'$q$, '1'),
      (7, 'productor', $q$lee solicitudes_compra$q$, 'q', $q$select count(*) from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, '1'),
      (8, 'productor', $q$lee vista_solicitudes_pendientes$q$, 'q', $q$select count(*) from public.vista_solicitudes_pendientes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, '1'),
      (9, 'productor', $q$lee perfiles$q$, 'q', $q$select (count(*) >= 1)::text from public.perfiles$q$, 'true'),
      (10, 'productor', $q$NO lee facturas$q$, 'q', $q$select count(*) from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '0'),
      (11, 'productor', $q$NO lee detalle_facturas$q$, 'q', $q$select count(*) from public.detalle_facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, '0'),
      (12, 'productor', $q$NO lee boletas$q$, 'q', $q$select count(*) from public.boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019'$q$, '0'),
      (13, 'productor', $q$NO lee detalle_boletas$q$, 'q', $q$select count(*) from public.detalle_boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000021'$q$, '0'),
      (14, 'productor', $q$NO lee pagos$q$, 'q', $q$select count(*) from public.pagos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, '0'),
      (15, 'productor', $q$NO lee plantillas_gastos_recurrentes$q$, 'q', $q$select count(*) from public.plantillas_gastos_recurrentes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, '0'),
      (16, 'productor', $q$NO lee movimientos_stock$q$, 'q', $q$select count(*) from public.movimientos_stock where id_detalle_factura = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, '0'),
      (17, 'productor', $q$NO lee vista_estado_pago$q$, 'q', $q$select count(*) from public.vista_estado_pago where id_documento = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '0'),
      (18, 'productor', $q$inserta solicitud (returning id)$q$, 'dml', $q$insert into public.solicitudes_compra (solicitante, id_insumo_okima, cantidad_solicitada) values ('ZZ_PRUEBA_RLS', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1) returning id$q$, 'filas=1'),
      (19, 'productor', $q$actualiza estado de solicitud$q$, 'dml', $q$update public.solicitudes_compra set estado = 'Cancelada' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, 'filas=1'),
      (20, 'productor', $q$NO borra solicitud (0 filas, sin error)$q$, 'dml', $q$delete from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'$q$, 'filas=0'),
      (21, 'productor', $q$inserta insumo (returning id)$q$, 'dml', $q$insert into public.insumos (nombre, id_subcategoria) values ('ZZ_PRUEBA_RLS insumo p', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002') returning id$q$, 'filas=1'),
      (22, 'productor', $q$actualiza insumo$q$, 'dml', $q$update public.insumos set descripcion = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$q$, 'filas=1'),
      (23, 'productor', $q$NO borra insumo$q$, 'dml', $q$delete from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005'$q$, 'filas=0'),
      (24, 'productor', $q$inserta vínculo N:M (returning id)$q$, 'dml', $q$insert into public.insumos_proveedores_okima (id_insumo_proveedor, id_insumo_okima, factor_conversion) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1) returning id$q$, 'filas=1'),
      (25, 'productor', $q$actualiza vínculo N:M$q$, 'dml', $q$update public.insumos_proveedores_okima set factor_conversion = 3 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'$q$, 'filas=1'),
      (26, 'productor', $q$NO borra vínculo N:M$q$, 'dml', $q$delete from public.insumos_proveedores_okima where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'$q$, 'filas=0'),
      (27, 'productor', $q$NO inserta proveedor$q$, 'dml', $q$insert into public.proveedores (nombre, rut) values ('ZZ_PRUEBA_RLS x', '1-9') returning id$q$, 'error 42501'),
      (28, 'productor', $q$NO actualiza proveedor (0 filas)$q$, 'dml', $q$update public.proveedores set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, 'filas=0'),
      (29, 'productor', $q$NO borra proveedor$q$, 'dml', $q$delete from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, 'filas=0'),
      (30, 'productor', $q$NO inserta insumo_proveedor$q$, 'dml', $q$insert into public.insumos_proveedores (nombre, id_proveedor) values ('ZZ_PRUEBA_RLS x', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003')$q$, 'error 42501'),
      (31, 'productor', $q$NO actualiza insumo_proveedor (0 filas)$q$, 'dml', $q$update public.insumos_proveedores set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006'$q$, 'filas=0'),
      (32, 'productor', $q$NO inserta factura$q$, 'dml', $q$insert into public.facturas (id_proveedor, numero_factura, fecha) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ-RLS-P', current_date)$q$, 'error 42501'),
      (33, 'productor', $q$NO inserta pago$q$, 'dml', $q$insert into public.pagos (monto, fecha_pago, id_factura) values (1, current_date, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012')$q$, 'error 42501'),
      (34, 'productor', $q$NO inserta boleta$q$, 'dml', $q$insert into public.boletas (monto) values (1)$q$, 'error 42501'),
      (35, 'productor', $q$NO inserta categoría$q$, 'dml', $q$insert into public.categorias (nombre) values ('ZZ_PRUEBA_RLS')$q$, 'error 42501'),
      (36, 'productor', $q$NO inserta plantilla$q$, 'dml', $q$insert into public.plantillas_gastos_recurrentes (nombre) values ('ZZ_PRUEBA_RLS')$q$, 'error 42501'),
      (37, 'productor', $q$NO escribe perfiles (UPDATE sin privilegio)$q$, 'dml', $q$update public.perfiles set nombre_mostrar = nombre_mostrar$q$, 'error 42501'),
      (38, 'contador', $q$lee proveedores$q$, 'q', $q$select count(*) from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, '1'),
      (39, 'contador', $q$lee insumos_proveedores$q$, 'q', $q$select count(*) from public.insumos_proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006'$q$, '1'),
      (40, 'contador', $q$lee insumos$q$, 'q', $q$select count(*) from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$q$, '1'),
      (41, 'contador', $q$lee insumos_proveedores_okima$q$, 'q', $q$select count(*) from public.insumos_proveedores_okima where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'$q$, '1'),
      (42, 'contador', $q$lee categorias$q$, 'q', $q$select count(*) from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, '1'),
      (43, 'contador', $q$lee subcategorias$q$, 'q', $q$select count(*) from public.subcategorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'$q$, '1'),
      (44, 'contador', $q$lee solicitudes_compra$q$, 'q', $q$select count(*) from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, '1'),
      (45, 'contador', $q$lee vista_solicitudes_pendientes$q$, 'q', $q$select count(*) from public.vista_solicitudes_pendientes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'$q$, '1'),
      (46, 'contador', $q$lee facturas$q$, 'q', $q$select count(*) from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '1'),
      (47, 'contador', $q$lee detalle_facturas$q$, 'q', $q$select count(*) from public.detalle_facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, '1'),
      (48, 'contador', $q$lee boletas$q$, 'q', $q$select count(*) from public.boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019'$q$, '1'),
      (49, 'contador', $q$lee detalle_boletas$q$, 'q', $q$select count(*) from public.detalle_boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000021'$q$, '1'),
      (50, 'contador', $q$lee pagos$q$, 'q', $q$select count(*) from public.pagos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, '1'),
      (51, 'contador', $q$lee plantillas_gastos_recurrentes$q$, 'q', $q$select count(*) from public.plantillas_gastos_recurrentes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, '1'),
      (52, 'contador', $q$lee movimientos_stock (embebido en fichas)$q$, 'q', $q$select count(*) from public.movimientos_stock where id_detalle_factura = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, '1'),
      (53, 'contador', $q$lee vista_estado_pago$q$, 'q', $q$select count(*) from public.vista_estado_pago where id_documento = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '1'),
      (54, 'contador', $q$lee perfiles$q$, 'q', $q$select (count(*) >= 1)::text from public.perfiles$q$, 'true'),
      (55, 'contador', $q$inserta factura (returning id)$q$, 'dml', $q$insert into public.facturas (id_proveedor, numero_factura, fecha) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ-RLS-C1', current_date) returning id$q$, 'filas=1'),
      (56, 'contador', $q$inserta línea de factura (returning id)$q$, 'dml', $q$insert into public.detalle_facturas (id, id_factura, id_insumo_proveedor, cantidad, precio_neto, subtotal) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000026', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006', 1, 100, 100) returning id$q$, 'filas=1'),
      (57, 'sistema', $q$trigger SECURITY DEFINER generó el movimiento de stock de esa línea$q$, 'q', $q$select count(*) from public.movimientos_stock where id_detalle_factura = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000026'$q$, '1'),
      (58, 'contador', $q$actualiza factura$q$, 'dml', $q$update public.facturas set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, 'filas=1'),
      (59, 'contador', $q$borra línea de factura (edición del documento)$q$, 'dml', $q$delete from public.detalle_facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000016'$q$, 'filas=1'),
      (60, 'contador', $q$NO borra factura (0 filas, sin error)$q$, 'dml', $q$delete from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, 'filas=0'),
      (61, 'contador', $q$inserta pago (returning id)$q$, 'dml', $q$insert into public.pagos (monto, fecha_pago, id_factura) values (10, current_date, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012') returning id$q$, 'filas=1'),
      (62, 'contador', $q$NO actualiza pago (0 filas)$q$, 'dml', $q$update public.pagos set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, 'filas=0'),
      (63, 'contador', $q$NO borra pago (0 filas)$q$, 'dml', $q$delete from public.pagos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, 'filas=0'),
      (64, 'contador', $q$inserta boleta (returning id)$q$, 'dml', $q$insert into public.boletas (monto) values (1000) returning id$q$, 'filas=1'),
      (65, 'contador', $q$actualiza boleta$q$, 'dml', $q$update public.boletas set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019'$q$, 'filas=1'),
      (66, 'contador', $q$inserta línea de boleta (returning id)$q$, 'dml', $q$insert into public.detalle_boletas (id_boleta, descripcion, cantidad, precio, subtotal) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000019', 'ZZ_PRUEBA_RLS', 1, 10, 10) returning id$q$, 'filas=1'),
      (67, 'contador', $q$borra línea de boleta (edición del documento)$q$, 'dml', $q$delete from public.detalle_boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000022'$q$, 'filas=1'),
      (68, 'contador', $q$NO borra boleta$q$, 'dml', $q$delete from public.boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019'$q$, 'filas=0'),
      (69, 'contador', $q$inserta proveedor (returning id)$q$, 'dml', $q$insert into public.proveedores (nombre, rut) values ('ZZ_PRUEBA_RLS prov c', '1-9') returning id$q$, 'filas=1'),
      (70, 'contador', $q$actualiza proveedor$q$, 'dml', $q$update public.proveedores set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, 'filas=1'),
      (71, 'contador', $q$NO borra proveedor$q$, 'dml', $q$delete from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, 'filas=0'),
      (72, 'contador', $q$inserta insumo_proveedor (returning id)$q$, 'dml', $q$insert into public.insumos_proveedores (nombre, id_proveedor) values ('ZZ_PRUEBA_RLS ip c', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003') returning id$q$, 'filas=1'),
      (73, 'contador', $q$actualiza insumo_proveedor$q$, 'dml', $q$update public.insumos_proveedores set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006'$q$, 'filas=1'),
      (74, 'contador', $q$NO borra insumo_proveedor$q$, 'dml', $q$delete from public.insumos_proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007'$q$, 'filas=0'),
      (75, 'contador', $q$inserta insumo (returning id)$q$, 'dml', $q$insert into public.insumos (nombre, id_subcategoria) values ('ZZ_PRUEBA_RLS insumo c', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002') returning id$q$, 'filas=1'),
      (76, 'contador', $q$actualiza insumo$q$, 'dml', $q$update public.insumos set descripcion = 'y' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$q$, 'filas=1'),
      (77, 'contador', $q$NO borra insumo$q$, 'dml', $q$delete from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005'$q$, 'filas=0'),
      (78, 'contador', $q$inserta solicitud (returning id)$q$, 'dml', $q$insert into public.solicitudes_compra (solicitante, id_insumo_okima, cantidad_solicitada) values ('ZZ_PRUEBA_RLS', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1) returning id$q$, 'filas=1'),
      (79, 'contador', $q$actualiza solicitud$q$, 'dml', $q$update public.solicitudes_compra set nivel_urgencia = 'Alta' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'$q$, 'filas=1'),
      (80, 'contador', $q$NO borra solicitud$q$, 'dml', $q$delete from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'$q$, 'filas=0'),
      (81, 'contador', $q$asocia solicitud a una línea (dispara marcar_solicitud_comprada)$q$, 'dml', $q$update public.detalle_facturas set id_solicitud_compra = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, 'filas=1'),
      (82, 'sistema', $q$la solicitud S3 quedó Comprada (trigger de invocador funciona con contador)$q$, 'q', $q$select estado from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011'$q$, 'Comprada'),
      (83, 'contador', $q$anula factura$q$, 'dml', $q$update public.facturas set estado_documento = 'anulado', motivo_anulacion = 'prueba' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000013'$q$, 'filas=1'),
      (84, 'contador', $q$NO reactiva factura anulada (trigger)$q$, 'dml', $q$update public.facturas set estado_documento = 'vigente' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000013'$q$, 'error 42501'),
      (85, 'contador', $q$borra vínculo N:M$q$, 'dml', $q$delete from public.insumos_proveedores_okima where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'$q$, 'filas=1'),
      (86, 'contador', $q$NO inserta categoría$q$, 'dml', $q$insert into public.categorias (nombre) values ('ZZ_PRUEBA_RLS')$q$, 'error 42501'),
      (87, 'contador', $q$NO inserta subcategoría$q$, 'dml', $q$insert into public.subcategorias (id_categoria, nombre) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'ZZ_PRUEBA_RLS')$q$, 'error 42501'),
      (88, 'contador', $q$NO actualiza categoría (0 filas)$q$, 'dml', $q$update public.categorias set nombre = nombre where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, 'filas=0'),
      (89, 'contador', $q$NO borra categoría$q$, 'dml', $q$delete from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, 'filas=0'),
      (90, 'contador', $q$NO inserta plantilla$q$, 'dml', $q$insert into public.plantillas_gastos_recurrentes (nombre) values ('ZZ_PRUEBA_RLS')$q$, 'error 42501'),
      (91, 'contador', $q$NO actualiza plantilla (0 filas)$q$, 'dml', $q$update public.plantillas_gastos_recurrentes set nombre = nombre where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, 'filas=0'),
      (92, 'contador', $q$NO inserta movimiento_stock directo$q$, 'dml', $q$insert into public.movimientos_stock (id_detalle_factura, id_insumo, qty) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000015', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 1)$q$, 'error 42501'),
      (93, 'contador', $q$NO escribe perfiles (UPDATE sin privilegio)$q$, 'dml', $q$update public.perfiles set nombre_mostrar = nombre_mostrar$q$, 'error 42501'),
      (94, 'admin', $q$lee facturas$q$, 'q', $q$select count(*) from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '1'),
      (95, 'admin', $q$lee detalle_facturas$q$, 'q', $q$select count(*) from public.detalle_facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000015'$q$, '1'),
      (96, 'admin', $q$lee boletas$q$, 'q', $q$select count(*) from public.boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019'$q$, '1'),
      (97, 'admin', $q$lee detalle_boletas$q$, 'q', $q$select count(*) from public.detalle_boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000021'$q$, '1'),
      (98, 'admin', $q$lee pagos$q$, 'q', $q$select count(*) from public.pagos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, '1'),
      (99, 'admin', $q$lee plantillas_gastos_recurrentes$q$, 'q', $q$select count(*) from public.plantillas_gastos_recurrentes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, '1'),
      (100, 'admin', $q$lee categorias$q$, 'q', $q$select count(*) from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, '1'),
      (101, 'admin', $q$lee subcategorias$q$, 'q', $q$select count(*) from public.subcategorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'$q$, '1'),
      (102, 'admin', $q$lee proveedores$q$, 'q', $q$select count(*) from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, '1'),
      (103, 'admin', $q$lee solicitudes_compra$q$, 'q', $q$select count(*) from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, '1'),
      (104, 'admin', $q$lee movimientos_stock$q$, 'q', $q$select count(*) from public.movimientos_stock where id_detalle_factura = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000026'$q$, '1'),
      (105, 'admin', $q$lee vista_estado_pago$q$, 'q', $q$select count(*) from public.vista_estado_pago where id_documento = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '1'),
      (106, 'admin', $q$inserta categoría (returning id)$q$, 'dml', $q$insert into public.categorias (id, nombre) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000027', 'ZZ_PRUEBA_RLS cat a') returning id$q$, 'filas=1'),
      (107, 'admin', $q$actualiza categoría$q$, 'dml', $q$update public.categorias set nombre = 'ZZ_PRUEBA_RLS cat a2' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000027'$q$, 'filas=1'),
      (108, 'admin', $q$borra categoría$q$, 'dml', $q$delete from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000027'$q$, 'filas=1'),
      (109, 'admin', $q$actualiza plantilla$q$, 'dml', $q$update public.plantillas_gastos_recurrentes set nombre = nombre where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, 'filas=1'),
      (110, 'admin', $q$borra plantilla$q$, 'dml', $q$delete from public.plantillas_gastos_recurrentes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000024'$q$, 'filas=1'),
      (111, 'admin', $q$borra solicitud$q$, 'dml', $q$delete from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'$q$, 'filas=1'),
      (112, 'admin', $q$actualiza pago$q$, 'dml', $q$update public.pagos set notas = 'x' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000018'$q$, 'filas=1'),
      (113, 'admin', $q$borra pago$q$, 'dml', $q$delete from public.pagos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000025'$q$, 'filas=1'),
      (114, 'admin', $q$borra factura sin pagos (cascada a sus líneas)$q$, 'dml', $q$delete from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000014'$q$, 'filas=1'),
      (115, 'admin', $q$reactiva factura anulada$q$, 'dml', $q$update public.facturas set estado_documento = 'vigente' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000013'$q$, 'filas=1'),
      (116, 'admin', $q$borra línea de boleta$q$, 'dml', $q$delete from public.detalle_boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000023'$q$, 'filas=1'),
      (117, 'admin', $q$borra boleta sin pagos$q$, 'dml', $q$delete from public.boletas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000020'$q$, 'filas=1'),
      (118, 'admin', $q$borra insumo sin referencias$q$, 'dml', $q$delete from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005'$q$, 'filas=1'),
      (119, 'admin', $q$borra movimiento_stock (revierte stock por trigger)$q$, 'dml', $q$delete from public.movimientos_stock where id_detalle_factura = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000026'$q$, 'filas=1'),
      (120, 'admin', $q$perfiles: sin escritura ni para admin (UPDATE sin privilegio)$q$, 'dml', $q$update public.perfiles set nombre_mostrar = nombre_mostrar$q$, 'error 42501'),
      (121, 'admin', $q$perfiles: INSERT denegado$q$, 'dml', $q$insert into public.perfiles (id, rol, nombre_mostrar) values (gen_random_uuid(), 'admin', 'x')$q$, 'error'),
      (122, 'anon', $q$NO lee proveedores$q$, 'q', $q$select count(*) from public.proveedores$q$, 'error 42501'),
      (123, 'anon', $q$NO lee facturas$q$, 'q', $q$select count(*) from public.facturas$q$, 'error 42501'),
      (124, 'anon', $q$NO lee pagos$q$, 'q', $q$select count(*) from public.pagos$q$, 'error 42501'),
      (125, 'anon', $q$NO lee categorias$q$, 'q', $q$select count(*) from public.categorias$q$, 'error 42501'),
      (126, 'anon', $q$NO lee perfiles$q$, 'q', $q$select count(*) from public.perfiles$q$, 'error 42501'),
      (127, 'anon', $q$NO lee solicitudes_compra$q$, 'q', $q$select count(*) from public.solicitudes_compra$q$, 'error 42501'),
      (128, 'anon', $q$NO lee insumos$q$, 'q', $q$select count(*) from public.insumos$q$, 'error 42501'),
      (129, 'anon', $q$NO lee boletas$q$, 'q', $q$select count(*) from public.boletas$q$, 'error 42501'),
      (130, 'anon', $q$NO lee vista_solicitudes_pendientes$q$, 'q', $q$select count(*) from public.vista_solicitudes_pendientes$q$, 'error 42501'),
      (131, 'anon', $q$NO lee vista_estado_pago$q$, 'q', $q$select count(*) from public.vista_estado_pago$q$, 'error 42501'),
      (132, 'anon', $q$NO inserta solicitud$q$, 'dml', $q$insert into public.solicitudes_compra (solicitante, id_insumo_okima, cantidad_solicitada) values ('x', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1)$q$, 'error 42501'),
      (133, 'anon', $q$NO actualiza proveedor$q$, 'dml', $q$update public.proveedores set notas = 'x'$q$, 'error 42501'),
      (134, 'anon', $q$NO borra solicitud$q$, 'dml', $q$delete from public.solicitudes_compra$q$, 'error 42501'),
      (135, 'anon', $q$NO ejecuta rol_actual()$q$, 'q', $q$select public.rol_actual()::text$q$, 'error 42501'),
      (136, 'sin_perfil', $q$rol_actual() es null$q$, 'q', $q$select coalesce(public.rol_actual()::text, 'null')$q$, 'null'),
      (137, 'sin_perfil', $q$NO lee proveedores$q$, 'q', $q$select count(*) from public.proveedores where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$q$, '0'),
      (138, 'sin_perfil', $q$NO lee categorias$q$, 'q', $q$select count(*) from public.categorias where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'$q$, '0'),
      (139, 'sin_perfil', $q$NO lee solicitudes_compra$q$, 'q', $q$select count(*) from public.solicitudes_compra where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000009'$q$, '0'),
      (140, 'sin_perfil', $q$NO lee insumos$q$, 'q', $q$select count(*) from public.insumos where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$q$, '0'),
      (141, 'sin_perfil', $q$NO lee facturas$q$, 'q', $q$select count(*) from public.facturas where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'$q$, '0'),
      (142, 'sin_perfil', $q$NO inserta solicitud$q$, 'dml', $q$insert into public.solicitudes_compra (solicitante, id_insumo_okima, cantidad_solicitada) values ('x', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1)$q$, 'error 42501'),
      (143, 'sin_perfil', $q$NO inserta insumo$q$, 'dml', $q$insert into public.insumos (nombre, id_subcategoria) values ('ZZ_PRUEBA_RLS x', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002')$q$, 'error 42501')
  ) as t (n, rol, prueba, tipo, sql, esperado);

  -- Todo lo que ocurre dentro de este sub-bloque se revierte al final.
  begin
    -- Datos de prueba mínimos (como postgres, que salta el RLS). Los triggers generan los movimientos.
    insert into public.categorias (id, nombre) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'ZZ_PRUEBA_RLS cat');
    insert into public.subcategorias (id, id_categoria, nombre) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'ZZ_PRUEBA_RLS sub');
    insert into public.proveedores (id, nombre, rut) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ_PRUEBA_RLS proveedor', '0-0');
    insert into public.insumos (id, nombre, id_subcategoria) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 'ZZ_PRUEBA_RLS insumo 1', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002'), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 'ZZ_PRUEBA_RLS insumo 2', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002');
    insert into public.insumos_proveedores (id, nombre, id_proveedor) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006', 'ZZ_PRUEBA_RLS ip 1', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 'ZZ_PRUEBA_RLS ip 2', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003');
    insert into public.insumos_proveedores_okima (id, id_insumo_proveedor, id_insumo_okima, factor_conversion) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000008', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 2);
    insert into public.solicitudes_compra (id, solicitante, id_insumo_okima, cantidad_solicitada) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000009', 'ZZ_PRUEBA_RLS', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000010', 'ZZ_PRUEBA_RLS', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000011', 'ZZ_PRUEBA_RLS', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 1);
    insert into public.facturas (id, id_proveedor, numero_factura, fecha, neto_total, iva, total) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ-RLS-1', current_date, 100, 19, 119),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000013', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ-RLS-2', current_date, 100, 19, 119),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000014', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'ZZ-RLS-3', current_date, 100, 19, 119);
    insert into public.detalle_facturas (id, id_factura, id_insumo_proveedor, cantidad, precio_neto, subtotal) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000015', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006', 1, 100, 100),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000016', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 1, 100, 100),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000017', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000014', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 1, 100, 100);
    insert into public.pagos (id, monto, fecha_pago, id_factura) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000018', 50, current_date, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000025', 20, current_date, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012');
    insert into public.boletas (id, monto) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000019', 10), ('aaaaaaaa-aaaa-4aaa-8aaa-000000000020', 10);
    insert into public.detalle_boletas (id, id_boleta, descripcion, cantidad, precio, subtotal) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000021', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019', 'ZZ_PRUEBA_RLS', 1, 10, 10),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000022', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000019', 'ZZ_PRUEBA_RLS', 1, 10, 10),
      ('aaaaaaaa-aaaa-4aaa-8aaa-000000000023', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000020', 'ZZ_PRUEBA_RLS', 1, 10, 10);
    insert into public.plantillas_gastos_recurrentes (id, nombre) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000024', 'ZZ_PRUEBA_RLS plantilla');

    for i in 0 .. jsonb_array_length(v_casos) - 1 loop
      c := v_casos -> i;
      v_rol  := c ->> 0;
      v_tipo := c ->> 2;
      v_sql  := c ->> 3;
      v_esp  := c ->> 4;

      v_uid := case v_rol
        when 'productor'  then v_uid_p
        when 'contador'   then v_uid_c
        when 'admin'      then v_uid_a
        when 'sin_perfil' then gen_random_uuid()
        else null
      end;
      v_habil := case v_rol
        when 'productor' then v_ok_p
        when 'contador'  then v_ok_c
        when 'admin'     then v_ok_a
        else true
      end;

      v_obt := null;
      v_msg := null;
      if not v_habil then
        v_obt := 'omitida';
        v_pasa := null;
      else
        if v_rol = 'anon' then
          perform set_config('request.jwt.claims', '', true);
          perform set_config('request.jwt.claim.sub', '', true);
          set local role anon;
        elsif v_rol in ('productor', 'contador', 'admin', 'sin_perfil') then
          perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
          perform set_config('request.jwt.claim.sub', v_uid::text, true);
          set local role authenticated;
        end if;

        begin
          if v_tipo = 'q' then
            execute v_sql into v_txt;
            v_obt := coalesce(v_txt, 'null');
          else
            execute v_sql;
            get diagnostics v_n = row_count;
            v_obt := 'filas=' || v_n;
          end if;
        exception when others then
          v_obt := 'error ' || sqlstate;
          v_msg := sqlerrm;
        end;

        reset role;
        perform set_config('request.jwt.claims', '', true);
        perform set_config('request.jwt.claim.sub', '', true);

        v_pasa := case
          when v_esp = 'error' then v_obt like 'error%'
          else v_obt = v_esp
        end;
      end if;

      v_res := v_res || jsonb_build_array(jsonb_build_object(
        'rol', v_rol, 'prueba', c ->> 1, 'esperado', v_esp, 'obtenido', v_obt, 'ok', v_pasa, 'detalle', v_msg));
    end loop;

    -- Revertir todo (datos de prueba, cambios de las pruebas, triggers de stock, etc.).
    raise exception 'fin de las pruebas' using errcode = 'P0777';
  exception when sqlstate 'P0777' then
    null;
  end;

  -- Garantía de que no quedó nada: ya fuera del sub-bloque revertido.
  select count(*) into v_residuos from public.proveedores where nombre like 'ZZ_PRUEBA_RLS%';
  v_res := v_res || jsonb_build_array(jsonb_build_object(
    'rol', 'sistema', 'prueba', 'sin residuos de prueba tras la reversión', 'esperado', '0',
    'obtenido', v_residuos::text, 'ok', v_residuos = 0));

  insert into pg_temp.resultados (orden, rol, prueba, esperado, obtenido, ok, detalle)
  select e.o, e.elem ->> 'rol', e.elem ->> 'prueba', e.elem ->> 'esperado', e.elem ->> 'obtenido',
         (e.elem ->> 'ok')::boolean, e.elem ->> 'detalle'
  from jsonb_array_elements(v_res) with ordinality as e (elem, o);
end
$prueba$;

-- Resumen en la fila 0 y detalle debajo. ok = false marca lo que no coincide con la matriz.
select orden, rol, prueba, esperado, obtenido, ok, detalle
from (
  select 0 as orden,
         'RESUMEN' as rol,
         (count(*) filter (where ok is false))::text || ' fallo(s), ' || (count(*) filter (where ok is null))::text || ' omitida(s), ' || (count(*) filter (where ok))::text || ' correcta(s)' as prueba,
         '0 fallos' as esperado,
         (count(*) filter (where ok is false))::text || ' fallos' as obtenido,
         (count(*) filter (where ok is false)) = 0 as ok,
         null::text as detalle
  from pg_temp.resultados
  union all
  select orden, rol, prueba, esperado, obtenido, ok, detalle from pg_temp.resultados
) r
order by orden;
