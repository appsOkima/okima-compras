# Formularios de Mantenedor en página dedicada

Locator: `odd/tasks/formularios-en-pagina.md` · Engram mirror: `odd/formularios-en-pagina/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Los formularios de crear/editar largos se cortan en el modal y el scroll es incómodo. Pasarlos a una página dedicada dentro de su sección, como el formulario de Facturas (`/facturas/nueva`, `/facturas/:id`).

## Alcance autorizado
Pedido del usuario (2026-09-29): transformar a página los modales de Proveedores, Catálogo (`insumos_proveedores`), Insumos Okima y Otros Gastos; **primero solo Proveedores** para revisarlo antes de aplicarlo al resto. La modal de Solicitud de compra se mantiene (formulario corto). Sin cambios de schema ni de reglas de negocio. Centros de Costo y Plantillas no están en el pedido: siguen con modal.

## Restricciones
- La modal sigue siendo el comportamiento por defecto del `Mantenedor` (lo usan las pantallas que no cambian).
- Mismo aviso de duplicados (nombre parecido / mismo RUT) que en la modal.
- Sin dependencias nuevas.

## Modo TDD
Off — fuente: sin configuración ni pedido del usuario (igual que fases previas). Runner: ninguno. Checks: `npx oxlint`, `npm run build`, aserciones node de funciones puras. Sin navegador para el orquestador: la revisión visual es del usuario.

## RDD y entrega
RDD: off (global) → entrega `disabled/unmanaged`. Rama `feat/formularios-en-pagina` desde `main`. Pronóstico: ~250 líneas (T1) + ~150 (T2). Estrategia: `ask-on-risk`; bajo ~400 por ahora.

## Tareas
- [x] **T1 — Proveedores en página dedicada.** Ruta: delegado (writer trigger: Mantenedor, FormularioRegistro, página nueva, lib de duplicados, App). Rutas `/proveedores/nuevo` y `/proveedores/:id`; "Nuevo"/"Editar" navegan ahí; la página carga el registro, muestra el formulario en tarjeta con campos en 2 columnas, "Volver al listado", y al guardar vuelve al listado con aviso de éxito. Aceptación: lint + build + aserciones node de la lógica de duplicados extraída.
- [ ] **T2 — Aplicar a Catálogo, Insumos Okima y Otros Gastos.** Pendiente de la aprobación del usuario tras revisar T1.

## Progreso / evidencia
- T1 (delegado a un writer por el writer trigger, revisado por el orquestador). Commit `2837d01`. Nuevo `PaginaRegistro` genérico + `lib/duplicados.js`; `Mantenedor` con prop `rutaFormulario` (sin ella, modal como antes); `FormularioRegistro` con `enColumnas` y flag `completo` (mismo nombre que en DetalleRegistro). `npx oxlint` exit 0; `npm run build` limpio (chunk FormularioProveedor 3.6 kB); 11 aserciones node de duplicados OK; `matchRoutes` confirma que `catalogo`/`por-vincular` le ganan a `:id`. RDD off → `disabled/unmanaged`. Sin prueba en navegador: pendiente la revisión del usuario.
- Decisiones abiertas para el usuario: sin confirmación al salir con cambios sin guardar (el modal tampoco la tenía); ninguna pestaña queda resaltada en /nuevo y /:id (igual que Facturas); tarjeta con `max-w-4xl`.

## Siguiente paso
El usuario revisa Proveedores en el navegador; con su aprobación, T2.
