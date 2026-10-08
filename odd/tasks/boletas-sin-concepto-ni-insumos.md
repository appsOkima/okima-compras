# Boletas sin concepto ni insumos del proveedor; tablas de líneas más angostas

- **Feature:** `boletas-sin-concepto-ni-insumos` · **Rama:** `feat/sprint2-boletas-pagos-roles` (continuación del Sprint 2)
- **Espejo Engram:** `odd/boletas-sin-concepto-ni-insumos/tasks` — **pendiente** (herramientas de memoria no disponibles en esta sesión).
- **TDD:** ON (elección explícita del usuario en el Sprint 2). **Runner:** `vitest` (`npm test`). Lógica pura en `src/lib/` con RED→GREEN; SQL y estilos se verifican por lectura + lint/build.
- **Entrega:** misma rama, un commit por tarea, un solo PR final (decisión del usuario); push y merge son del usuario. Pronóstico ≈600–900 líneas (sobre el heurístico de ~400, aceptado).
- **Ruta:** delegada (escritores), por los disparadores de mapeo y escritura.

## Petición del usuario (textual, resumida)

1. `boletas.concepto` se elimina sin respaldo: ya está copiado a la `descripcion` de cada línea de boleta.
2. La vinculación de una línea de boleta con una solicitud de compra se mantiene. Pero en las boletas **ya no se registran insumos del proveedor** y, por tanto, **tampoco se vincula a insumos Okima** (sin stock por boletas).
3. Tabla de **líneas de factura** con menos columnas: se van N° FACTURA, DESCUENTO %, STOCK SUMADO, INSUMO OKIMA, FORMATO.
4. Tabla de **líneas de boleta**: esconder proveedor, insumo Okima y boleta (que contenía concepto y número de boleta; ninguno hace falta).

## Decisiones de diseño tomadas (a confirmar con el usuario en el informe)

- **Cómo se nombra una boleta** donde antes salía `concepto` (listados, sección Pagos, mensajes de borrado/anulación, ficha): descripción de la primera línea, más «(+N más)» si hay varias; «Boleta sin líneas» como último recurso.
- **Stock de boletas:** se retira por completo (triggers, `movimientos_stock.id_detalle_boleta`, `detalle_boletas.id_insumo_proveedor`). Si existieran movimientos de boleta, la migración los borra revirtiendo el stock (con aviso), porque las boletas dejan de mover stock.
- **CSV de líneas de factura:** las columnas que salen de la tabla en pantalla se conservan en la exportación CSV (datos para el futuro ERP). Las de líneas de boleta que dejan de existir (insumo Okima, stock) se eliminan también del CSV.

## Tareas

- [x] **B1 Base de datos (migración 13).** Eliminar `boletas.concepto`; eliminar `detalle_boletas.id_insumo_proveedor`; retirar el stock de boletas (`generar_movimientos_stock_boleta`, sus triggers, `movimientos_stock.id_detalle_boleta`, el CHECK de origen y su índice único; `id_detalle_factura` vuelve a NOT NULL); `sincronizar_stock_estado_documento` solo para facturas; comprobaciones previas, reversa, verificación y `schema.sql`.
- [x] **B2 Boletas en la interfaz.** Sin campo concepto; líneas sin insumo del proveedor; etiqueta de boleta derivada de sus líneas; ingreso rápido desde plantilla (la descripción de la línea = nombre de la plantilla); sección Pagos, modales y avisos que usaban `concepto`.
- [x] **B3 Tablas de líneas.** Líneas de factura sin las 5 columnas; líneas de boleta sin proveedor, insumo Okima ni boleta.
- [x] **B4 Documentación.** `CLAUDE.md`, `Sprint2.md` §6, `historial-decisiones.md`, README.

## Progreso y evidencia

- **B1** (ruta **D**, escritor SQL): migración `2026-10-02-13-boletas-sin-concepto-ni-insumos.sql` (+ `-down`, + `-13-verificacion.sql`, UN solo SELECT). Revisada por mí: prechecks (toda boleta con ≥1 línea con descripción; sin dependencias de `concepto`), foto del stock, borrado de movimientos de boleta revirtiendo stock con verificación aritmética, `sincronizar_stock_estado_documento` solo de facturas, drops en orden. **No ejecutada ni validada por parser.** Rompe scripts históricos que usan `boletas.concepto`/`id_detalle_boleta` (pruebas-roles, verificaciones 08/10, down 08): se actualizan aparte. RDD off → disabled/unmanaged.
- **B2+B3** (ruta **D**, escritor interfaz): RED observado (13 fallos incl. `nombreBoleta` sin módulo), GREEN 226/226; lint y build pasan y el grep final en `src/` no deja referencias a `concepto`/`id_insumo_proveedor`/`id_detalle_boleta` de boletas (re-verificado por mí). `nombreBoleta` en `src/lib/nombreBoleta.js` (evita ciclo de imports). Líneas de factura: 5 columnas fuera de pantalla (4 quedan solo en CSV; «Formato» se eliminó, su dato ya estaba en el CSV como `formato_unidad`/`cantidad_formato`). Líneas de boleta: fecha, descripción, cantidad, precio, subtotal, solicitud. NO probado contra Supabase real ni en navegador: embeds nuevos `lineas:detalle_boletas(descripcion, created_at)` sin verificar. Depende de la migración 13. RDD off → disabled/unmanaged.
- **B4** (ruta **D**, escritor docs): `CLAUDE.md`, `historial-decisiones.md` (sección «Ajuste posterior al cierre del Sprint 2»), `Sprint2.md` (§6.3 y marcas «superado» en §1.4/§1.6) y `README.md` (fila 13). Corregí a mano una frase del historial que atribuía una razón no declarada por el usuario. RDD off → disabled/unmanaged.
- Scripts históricos actualizados (commit aparte): pruebas-roles, verificaciones 08/09/10 y reversas 08/09.
- Commit previo e independiente: script `cambiar-clave.mjs` y pendientes del Sprint 3.

## Siguiente paso

Cerrada en código; pendiente que el usuario aplique la migración 13, despliegue y pruebe.
