# RUT: formato al escribir y validación módulo 11

Locator: `odd/tasks/rut-formato-validacion.md` · Engram mirror: `odd/rut-formato-validacion/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Al escribir un RUT se formatea al vuelo (puntos y guion, como https://scarlet-ettie-30.tiiny.site/: quita ceros iniciales, el último carácter es el DV en mayúscula, puntos cada 3 dígitos del cuerpo), solo acepta dígitos y K, y al perder el foco se valida el DV con módulo 11.

## Alcance autorizado
Pedido del usuario (2026-09-29): el RUT de Proveedor. Se aplica a los dos lugares donde se escribe el RUT de un proveedor: el formulario de Proveedores (`/proveedores/nuevo|:id`) y la creación al vuelo desde Facturas (`SelectorProveedorFactura`), que es el mismo dato. Sin cambios de schema.

## Decisiones
- Un RUT con DV inválido muestra el error al salir del campo y también bloquea el guardado (no tendría sentido validar y dejar guardar).
- Se guarda formateado (`76.123.456-7`); al editar un RUT viejo sin formato se muestra formateado. Las comparaciones de duplicados siguen con `normalizarRut`.
- Máximo 9 caracteres significativos (cuerpo de hasta 8 dígitos + DV). La K solo puede ser DV.

## Modo TDD
Off — fuente: sin configuración ni pedido del usuario. Runner: ninguno. Checks: `npx oxlint`, `npm run build`, aserciones node de `src/lib/rut.js`.

## RDD y entrega
RDD off → `disabled/unmanaged`. Rama `feat/rut-formato-validacion` desde `main`. Pronóstico ~200 líneas. Estrategia: `single-pr` (como la feature anterior).

## Tareas
- [x] **T1 — Formato y validación de RUT.** Ruta: delegado (writer trigger: lib nueva, componente nuevo, FormularioRegistro, FormularioProveedor, SelectorProveedorFactura). `src/lib/rut.js` (formatear, limpiar, validar mód. 11), `InputRut` con caret estable, campo `tipo: 'rut'` en FormularioRegistro con validación al perder foco y al guardar, y uso en Facturas. Aceptación: lint + build + aserciones node.

## Progreso / evidencia
- T1 (delegado a writer, revisado por el orquestador). Commit `5cf3982`. `src/lib/rut.js` (limpiar/formatear/calcularDv/validarRut + cursor), `InputRut`, campo `tipo: 'rut'` (valida al salir y al guardar), Proveedores y creación al vuelo en Facturas. `npx oxlint` exit 0, `npm run build` limpio, 90 aserciones node OK (re-corridas por el orquestador). Sin prueba en navegador.
- Hallazgo: `supabase/datos-prueba.sql` tiene 10 de 12 RUT con DV inválido; `cargar-facturas-reales.sql` crea proveedores con `rut = 'POR COMPLETAR'` (al editarlos el campo aparece vacío y hay que ingresar un RUT válido). Archivos SQL sin cambios: decisión del usuario.

## Siguiente paso
Revisión del usuario en el navegador; decidir si corregir los RUT de datos de prueba; push/PR a pedido del usuario.
