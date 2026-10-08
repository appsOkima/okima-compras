-- Sprint 2 / T2 (ajuste): las notas ya no salen en las tablas de la app; solo en la
-- hoja impresa de Pendientes. La vista suma, al final de sus columnas, las notas que
-- acompañan a cada solicitud en papel: del insumo Okima (notas_insumo), de los
-- proveedores sugeridos (notas_proveedores) y de los insumos de catálogo de esos
-- proveedores vinculados al insumo (notas_catalogo). Idempotente.
-- Reversa: 2026-10-02-04-notas-impresion-solicitudes-down.sql.

begin;

create or replace view vista_solicitudes_pendientes
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
  from insumos_proveedores ip
  join proveedores p on p.id = ip.id_proveedor
  where ip.id_insumo_okima = s.id_insumo_okima
) sug on true
where s.estado = 'Pendiente'
order by s.nivel_urgencia desc, s.fecha_esperada asc nulls last, s.created_at asc;

commit;
