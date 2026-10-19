# Sprint 3: agilidad en ingreso y mantenedores

## Objetivo
Avisar duplicados de factura al escribir, quitar el campo solicitante, guardar precios del catálogo desde facturas y poder crear insumos Okima desde los combobox de vínculos.

## Alcance autorizado
Los 4 cambios pedidos. La carga de CSV para editar la base queda fuera (Sprint 4); solo se responde su viabilidad.

## Config
- TDD: activo para lógica pura de `src/lib/` (fuente: CLAUDE.md del proyecto), runner `npm test` (vitest). UI/SQL: `npm run lint` + `npm run build`.
- Delivery: ask-on-risk. Mirror Engram: tema `odd/sprint3-agilidad-ingreso/tasks`, proyecto okima-compras (reconstruido desde este archivo tras reconectar engram).

## Tareas
- [x] T1 Aviso toast de factura duplicada (proveedor + N°) mientras se escribe. Sin sistema de toast previo: crear uno mínimo. Ruta: delegada (FormularioFactura + lib + toast).
- [x] T2 Solicitudes: quitar campo solicitante; guardar `solicitante` = nombre_mostrar e `id_solicitante` = perfil.id del usuario logueado. Ruta: delegada.
- [x] T3 Precio de catálogo: al guardar factura (crear/editar), si `precio_neto` de la línea difiere de `insumos_proveedores.precio_clp`, actualizar `precio_clp` y `fecha_actualizacion` (fecha de factura; no pisar si el catálogo tiene fecha más nueva). Cubre insumo creado al vuelo. Ruta: delegada.
- [x] T4 Combobox con "Crear insumo Okima" (nombre + subcategoría, nombre precargado) en EditorVinculos y PorVincular; reutilizar patrón de SelectorInsumo. Ruta: delegada.
- [x] T5 Insumos de proveedor que no se vinculan: columna booleana `se_vincula` (default true, not null) en `insumos_proveedores` (migración numerada con down y verificación, schema.sql y README; NO aplicar SQL). En "Por vincular" botón "Descartar" (se_vincula=false) que los saca de esa lista; sección nueva "Sin vínculo" (descartados) para encontrarlos y "Restaurar" (se_vincula=true). Switch en el formulario del insumo del proveedor. Las líneas de factura con solicitud sobre un insumo con se_vincula=false no proponen vincular. Ruta: delegada (migración + schema + 3-5 archivos UI + lib con tests).

## Criterios
`npm test`, `npm run lint`, `npm run build` verdes.

## Evidencia / commits
T2 41ec21f; T1+T3 f9fff7d; T4 0b11331; T5 migración 14 (commit en git log). Verificado: npm test (260), lint, build. Sin prueba manual en navegador.
