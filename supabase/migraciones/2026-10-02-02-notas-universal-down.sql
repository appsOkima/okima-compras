-- Reversa de 2026-10-02-02-notas-universal.sql.
-- Elimina solo las columnas `notas` que esa migración agregó (insumos_proveedores,
-- insumos, solicitudes_compra, facturas y detalle_facturas); proveedores y boletas
-- ya la tenían antes y se conservan. BORRA el contenido de esas notas.
-- Idempotente. La vista se recrea sin `notas` (create or replace no puede quitar
-- columnas, por eso drop + create).

begin;

drop view if exists vista_solicitudes_pendientes;

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

alter table insumos_proveedores drop column if exists notas;
alter table insumos             drop column if exists notas;
alter table solicitudes_compra  drop column if exists notas;
alter table facturas            drop column if exists notas;
alter table detalle_facturas    drop column if exists notas;

commit;
