-- Sprint 2 / T2: campo `notas` universal (Sprint2.md §1.2).
-- Agrega `notas text` a las tablas que no la tenían. proveedores y boletas ya la
-- traen (IF NOT EXISTS no las toca). detalle_boletas no existe aún: su `notas`
-- llega con su creación (T5). pagos la trae desde su creación (T7).
-- Recrea vista_solicitudes_pendientes con `notas` al final de la lista de columnas
-- (create or replace solo permite agregar columnas al final) para mostrarla en
-- Pendientes y en la impresión.
-- Idempotente. Reversa: 2026-10-02-02-notas-universal-down.sql.

begin;

alter table proveedores         add column if not exists notas text;
alter table insumos_proveedores add column if not exists notas text;
alter table insumos             add column if not exists notas text;
alter table solicitudes_compra  add column if not exists notas text;
alter table facturas            add column if not exists notas text;
alter table detalle_facturas    add column if not exists notas text;
alter table boletas             add column if not exists notas text;

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
