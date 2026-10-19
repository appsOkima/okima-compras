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

## Criterios
`npm test`, `npm run lint`, `npm run build` verdes.

## Evidencia / commits
T2 41ec21f; T1+T3 f9fff7d; T4 0b11331. Verificado: npm test (256), lint, build. Sin prueba manual en navegador.
