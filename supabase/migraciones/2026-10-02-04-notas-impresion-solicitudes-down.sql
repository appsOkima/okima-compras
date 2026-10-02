-- Reversa de 2026-10-02-04-notas-impresion-solicitudes.sql: la vista vuelve a la
-- versión de T2 (sin notas_insumo, notas_proveedores ni notas_catalogo; create or
-- replace no puede quitar columnas, por eso se recrea). Idempotente.

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
  coalesce(sug.proveedores_sugeridos, '') as proveedores_sugeridos,
  s.notas
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

commit;
