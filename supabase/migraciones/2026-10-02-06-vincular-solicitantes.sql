-- Sprint 2 / T3a: completa solicitudes_compra.id_solicitante.
-- Ejecutar DESPUÉS de sembrar los usuarios (scripts/seed-usuarios.mjs).
-- Une por nombre sin distinguir mayúsculas ni espacios en los bordes. No toca
-- el texto `solicitante`; sin coincidencia (o con más de un perfil que coincida)
-- queda null. Idempotente: solo completa filas con id_solicitante vacío.
-- Reversa: 2026-10-02-06-vincular-solicitantes-down.sql.

begin;

update public.solicitudes_compra s
set id_solicitante = p.id
from public.perfiles p
where s.id_solicitante is null
  and lower(btrim(s.solicitante)) = lower(btrim(p.nombre_mostrar))
  and (select count(*) from public.perfiles p2
       where lower(btrim(p2.nombre_mostrar)) = lower(btrim(s.solicitante))) = 1;

commit;
