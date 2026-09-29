# Resumen de gastos mensual por centro de costo

Locator: `odd/tasks/resumen-gastos.md` · Engram mirror: `odd/resumen-gastos/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Panel nuevo que junta facturas y otros gastos en un resumen mensual, filtrable por centro de costo (categoría y subcategoría). Solo lectura, sin cambios en la base.

## Alcance autorizado
Pedido del usuario (2026-09-29). Nueva sección en el menú (`/resumen`), sin schema nuevo ni vistas SQL.

## Decisiones
- Facturas cuentan por su **total con IVA** (decisión del usuario, 2026-09-29: el "Pago IVA" de Otros Gastos es el IVA de las ventas, no el de compras, así que no hay doble conteo).
- Centro de costo de una factura: por línea, vía `detalle_facturas → insumos_proveedores → insumos.id_subcategoria → categoría`. El total de la factura se reparte entre sus líneas en proporción a su subtotal (así incluye descuento global e IVA). Líneas sin insumo Okima vinculado → "Sin centro de costo"; factura sin líneas o con subtotales 0 → todo su total a "Sin centro de costo".
- Otros gastos: `monto` en su `id_subcategoria` (vacío → "Sin centro de costo").
- Mes por `fecha` de la factura / del gasto.
- Exportación CSV en las tablas (regla transversal).

## Modo TDD
Off — fuente: sin configuración ni pedido del usuario. Runner: ninguno. Checks: `npx oxlint`, `npm run build`, aserciones node de la lib de agregación.

## RDD y entrega
RDD off → `disabled/unmanaged`. Rama `feat/resumen-gastos` desde `main` (independiente de RUT/números). Pronóstico ~350 líneas. Estrategia `single-pr`.

## Tareas
- [x] **T1 — Panel Resumen de gastos.** Ruta: delegado (writer trigger: lib nueva, página nueva, secciones, App). Aceptación: lint + build + aserciones node (reparto proporcional, sin vincular, sin líneas, filtros, totales por mes y por centro).

## Progreso / evidencia
- T1 (delegado a writer, revisado por el orquestador). Commit `94419ff`. `src/lib/resumen.js` (reparto por resto mayor en pesos enteros: la suma cuadra exacto con el total de cada factura; agregados por mes y por centro; filtros categoría/subcategoría/"sin centro"/mes), página `src/pages/resumen/Resumen.jsx` (2 tablas con TablaDatos + CSV, aviso de "sin centro de costo" con enlace a Por vincular), sección en `secciones.js` y ruta en `App.jsx`. Carga paginada de 1000 filas (límite por defecto de Supabase). `npx oxlint` exit 0, `npm run build` limpio, 46 aserciones node OK (re-corridas por el orquestador). ~470 líneas: sobre la heurística por las dos tablas y filtros; sin partir. Sin prueba en navegador ni con datos reales.
- Nota: el centro de costo sale del vínculo actual del insumo; vincular un insumo después mueve sus líneas pasadas a su centro en el resumen (el stock sigue sin aplicarse retroactivo).

## Siguiente paso
Revisión del usuario en el navegador con datos reales; push/PR a pedido.
