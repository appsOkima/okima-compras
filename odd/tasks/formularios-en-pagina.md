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
- [x] **T3 — Confirmar al salir con cambios sin guardar.** (Se ejecuta antes que T2 para que las páginas nuevas ya lo traigan.) Ruta: delegado (writer trigger: App/router, FormularioRegistro, PaginaRegistro, hook nuevo). `App.jsx` pasa de `BrowserRouter` a `createBrowserRouter` (requisito de `useBlocker`); hook `useConfirmarSalida(sucio)`: `useBlocker` para toda navegación interna (menú, pestañas, Volver, atrás del navegador) con `window.confirm`, y `beforeunload` para recargar/cerrar; tras guardar no bloquea. Aceptación: lint + build; rutas iguales.
- [x] **T2 — Aplicar a Catálogo, Insumos Okima y Otros Gastos.** Autorizado por el usuario (2026-09-29, "Agrega a las demás pantallas el cambio"). Ruta: delegado (writer trigger). Rutas `/proveedores/catalogo/nuevo|:id`, `/insumos/nuevo|:id`, `/gastos/nuevo|:id`; el ingreso rápido de gasto recurrente (modal en Otros Gastos) pasa a `/gastos/nuevo?plantilla=<id>` con los valores pre-llenados. Aceptación: lint + build + rutas verificadas con matchRoutes.

## Progreso / evidencia
- T1 (delegado a un writer por el writer trigger, revisado por el orquestador). Commit `2837d01`. Nuevo `PaginaRegistro` genérico + `lib/duplicados.js`; `Mantenedor` con prop `rutaFormulario` (sin ella, modal como antes); `FormularioRegistro` con `enColumnas` y flag `completo` (mismo nombre que en DetalleRegistro). `npx oxlint` exit 0; `npm run build` limpio (chunk FormularioProveedor 3.6 kB); 11 aserciones node de duplicados OK; `matchRoutes` confirma que `catalogo`/`por-vincular` le ganan a `:id`. RDD off → `disabled/unmanaged`. Sin prueba en navegador: pendiente la revisión del usuario.
- Decisiones abiertas para el usuario: ninguna pestaña queda resaltada en /nuevo y /:id (igual que Facturas); tarjeta con `max-w-4xl`.

- T3 (delegado, revisado por el orquestador). Commit `8b10d16`. `createBrowserRouter` + `RouterProvider` (árbol de rutas idéntico salvo indentación); `useConfirmarSalida(sucio)` con `useBlocker` + `beforeunload`, `permitirSalida()` por ref antes del navigate post-guardado; `FormularioRegistro.onCambio`. oxlint exit 0, build limpio, matchRoutes 16/16. FormularioFactura sin cambios (mantiene su confirm solo en Cancelar).
- T2 (delegado, revisado por el orquestador). Commit `a265922`. Páginas `FormularioInsumoProveedor`, `FormularioInsumo`, `FormularioGasto`; ingreso rápido → `/gastos/nuevo?plantilla=<id>` (plantilla inválida → error con vuelta al listado); `PaginaRegistro` suma `tituloNuevo`, `buscarDuplicados` propio, `textoDuplicados`, `cargandoExtra`/`errorExtra`; flag de campo `nuevaFila`. oxlint exit 0 (re-corrido por el orquestador), build limpio, matchRoutes 24/24. ~640 líneas: sobre la heurística de 400 porque mueve la configuración de formularios de los listados a sus páginas. Modales restantes: solo "Ver detalles", Centros de Costo/Plantillas (fallback del Mantenedor) y Solicitudes, como se pidió.
- Entrega: rama acumula ~1100 líneas en src (sobre el presupuesto de ~400); estrategia `ask-on-risk` → pendiente que el usuario elija cadena de PRs si quiere dividirla. RDD off → `disabled/unmanaged`. Sin push.

## Siguiente paso
Revisión del usuario en el navegador de las 4 pantallas y la confirmación de salida. Opcional (no autorizado aún): llevar la misma confirmación de salida a Facturas.

- Revisión de T1 por el usuario (2026-09-29): pidió confirmación al salir a medio llenar (→ T3) y aplicar al resto (→ T2).
