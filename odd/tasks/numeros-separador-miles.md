# Números: separador de miles al escribir y coma decimal

Locator: `odd/tasks/numeros-separador-miles.md` · Engram mirror: `odd/numeros-separador-miles/tasks` (proyecto `okima-compras`, vía CLI `engram save`).

## Objetivo
En todo input numérico (cantidades y dinero) poner el punto de miles al vuelo mientras se escribe (`1234567` → `1.234.567`), como el RUT. Los decimales solo con coma (`1.234,5`); el punto no se acepta como decimal.

## Alcance autorizado
Pedido del usuario (2026-09-29), tras aprobar el formato de RUT. Todos los inputs numéricos: campos `tipo: 'numero'` de FormularioRegistro (Catálogo, Insumos, Otros Gastos, Plantillas, Solicitudes) y los de Facturas (cantidad, precio neto y descuento % de línea; descuento % global). Sin cambios de schema.

## Decisiones
- Campos enteros (`paso: 1`, montos CLP) no aceptan coma; el resto sí, una sola.
- El punto tecleado se ignora (es solo separador de miles). Pegar `1.234,5` funciona; pegar `1234.5` se lee como 12345 (regla: el punto es de miles).
- Sin negativos (ningún campo los usa).
- Los valores cargados de la base se muestran formateados (`1234.5` → `1.234,5`); el parseo quita puntos y cambia coma por punto.
- Se reutiliza el enfoque de cursor estable de `InputRut`.

## Modo TDD
Off — fuente: sin configuración ni pedido del usuario. Runner: ninguno. Checks: `npx oxlint`, `npm run build`, aserciones node de la lib nueva, de `aNumero`/subtotales en `lib/facturas.js` y de `lib/rut.js` (no debe romperse).

## RDD y entrega
RDD off → `disabled/unmanaged`. Rama `feat/numeros-separador-miles`, apilada sobre `feat/rut-formato-validacion` (sin push ni PR aún). Pronóstico ~300 líneas. Estrategia: `single-pr` por feature; al abrir PRs, decidir con el usuario si van apilados o juntos.

## Tareas
- [x] **T1 — Input numérico con separador de miles y coma decimal.** Ruta: delegado (writer trigger: lib nueva, InputNumero, FormularioRegistro, lib/facturas, LineaFactura, FormularioFactura). Aceptación: lint + build + aserciones node.

## Progreso / evidencia
- T1 (delegado a writer, revisado por el orquestador). Commit `aa76865`. `lib/numero.js` (limpiar/formatear, `aNumeroDesdeTexto` para lo escrito, `numeroDesdeBase`/`numeroAEditable` para la base), `lib/cursor.js` + `InputFormateado` compartidos con el RUT, `InputNumero`; FormularioRegistro `tipo: 'numero'` (enteros si `paso: 1`); Facturas: `aNumero` nuevo formato, carga desde base con `numeroAEditable`, `mismoValor` base vs. formulario sin cambios falsos. Cubiertos: Solicitudes cantidad; Gastos monto (entero); Plantillas monto_default (entero); Insumos dimensiones, precio_venta (entero); Catálogo precio_clp (entero), cantidad_formato y dimensiones; Facturas cantidad/precio_neto/descuento de línea y descuento global. `npx oxlint` exit 0, `npm run build` limpio, 173 aserciones nuevas + 90 de RUT OK (re-corridas por el orquestador). El orquestador verificó que todos los llamadores de `aNumero`/`subtotalDe`/`calcularTotales` usan estado del formulario. Sin prueba en navegador.
- Para el usuario: un monto entero guardado con decimales se muestra redondeado; en un celular con región de punto decimal el teclado `decimal` podría no ofrecer coma.

## Siguiente paso
Revisión del usuario en el navegador; luego decidir PRs (RUT + números: apilados o uno solo).
