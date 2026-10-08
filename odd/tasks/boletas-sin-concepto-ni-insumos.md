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

- [ ] **B1 Base de datos (migración 13).** Eliminar `boletas.concepto`; eliminar `detalle_boletas.id_insumo_proveedor`; retirar el stock de boletas (`generar_movimientos_stock_boleta`, sus triggers, `movimientos_stock.id_detalle_boleta`, el CHECK de origen y su índice único; `id_detalle_factura` vuelve a NOT NULL); `sincronizar_stock_estado_documento` solo para facturas; comprobaciones previas, reversa, verificación y `schema.sql`.
- [ ] **B2 Boletas en la interfaz.** Sin campo concepto; líneas sin insumo del proveedor; etiqueta de boleta derivada de sus líneas; ingreso rápido desde plantilla (la descripción de la línea = nombre de la plantilla); sección Pagos, modales y avisos que usaban `concepto`.
- [ ] **B3 Tablas de líneas.** Líneas de factura sin las 5 columnas; líneas de boleta sin proveedor, insumo Okima ni boleta.
- [ ] **B4 Documentación.** `CLAUDE.md`, `Sprint2.md` §6, `historial-decisiones.md`, README.

## Progreso y evidencia

- Commit previo e independiente: script `cambiar-clave.mjs` y pendientes del Sprint 3.

## Siguiente paso

B1.
