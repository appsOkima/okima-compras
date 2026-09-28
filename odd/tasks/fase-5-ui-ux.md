# Fase 5 — UI/UX y exportación

Locator: `odd/tasks/fase-5-ui-ux.md` · Engram mirror: `odd/fase-5-ui-ux/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
Refinar la app tras la Fase 4: tamaño del bundle, tablas cómodas con mucha data, y detalles de pulido. CSV e impresión ya existen (Fase 4); aquí se auditan y se protegen.

## Problema / por qué
- El build avisa de un chunk único de 610 kB (planificado para esta fase).
- Con la data de `supabase/datos-prueba.sql` (121 líneas de factura, 95 insumos de proveedor) las tablas no ordenan ni paginan.
- Auditoría: las 15 vistas de tabla usan `TablaDatos` (un solo botón "Exportar CSV"); impresión de Pendientes ya con `print:`/`.tabla-datos`.

## Alcance autorizado
`CLAUDE.md`, Fase 5: "refinamiento de estilos, lógica de impresión y botones de exportación CSV". Sin cambios de schema ni de reglas de negocio. Autorización del usuario: "Pasemos a la fase 5" (2026-09-28); alcance concreto elegido por el orquestador, el usuario puede redirigirlo.

## Restricciones
- La impresión debe seguir mostrando todas las filas (la paginación no puede recortar el papel).
- El CSV exporta todas las filas filtradas, no solo la página visible.
- Sin dependencias nuevas.

## Modo TDD
Off — fuente: sin configuración ni pedido del usuario (igual que fases previas). Runner: ninguno. Checks: `npx oxlint`, `npm run build`, aserciones node de funciones puras. Sin navegador disponible para el orquestador: la revisión visual es del usuario.

## RDD y entrega
Entrega: `disabled/unmanaged`. Estrategia: `stacked-to-main` (elegida en Fase 4). Rama `feat/fase-5-ui-ux`, apilada sobre `feat/fase-4-solicitudes-estados`. Pronóstico: ~350 líneas autoradas. Push de la pila completa hecho a pedido del usuario (2026-09-28); sin PRs creados.

## Tareas
- [x] **T1 — Code-splitting.** Ruta: inline (App.jsx + Layout; sin cambios en vite.config: Rolldown ya separa `supabase-js` en un chunk compartido). Páginas con `React.lazy` + `Suspense` en el Layout; los contenedores de sección (pestañas) quedan eager para que no parpadeen. Aceptación: build sin aviso de >500 kB; todas las rutas siguen resolviendo.
- [ ] **T2 — Ordenar y paginar `TablaDatos`.** Ruta: delegado (writer trigger: componente + lib pura nueva). Clic en encabezado ordena asc/desc (números y fechas por valor, texto sin distinguir tildes); paginación de 50 con "Anterior/Siguiente" y contador; el orden inicial de cada vista se conserva hasta el primer clic; en papel se imprimen todas las filas; CSV con todas las filtradas en el orden mostrado. Lógica en `src/lib/tabla.js`, verificada con node. Aceptación: lint + build + aserciones.
- [x] **T3 — Pulido.** Ruta: inline. Título de pestaña por sección (`document.title`), Modal con trampa de foco y devolución del foco al cerrar. Aceptación: lint + build.

## Progreso / evidencia

- T3: `document.title` por sección en Layout (`<Sección> · Okima Compras`); Modal con trampa de Tab/Shift+Tab y devolución del foco al cerrar. `npx oxlint` y `npm run build` limpios. Verificación visual/teclado pendiente del usuario (sin navegador disponible).
- T1: `npm run build` sin aviso de >500 kB; mayor chunk 275 kB (index) + 219 kB (compartido con supabase-js); 30 chunks por pantalla. `npx oxlint` sin hallazgos.
- Rama y push de la pila Fase 1–4 (12 ramas) a `origin` hechos.

## Siguiente paso
T1 → T2 → T3; luego el usuario revisa en el navegador.
