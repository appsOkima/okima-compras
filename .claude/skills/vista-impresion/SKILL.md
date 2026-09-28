---
name: vista-impresion
description: Patrón de vista imprimible (@media print) para Solicitudes de Compra en el proyecto Okima. Úsalo al construir la lista o la impresión de solicitudes pendientes.
---

# Vista de impresión — Solicitudes de Compra

## Datos
Se basa en la vista `vista_solicitudes_pendientes` (creada en la Fase 1): solo `estado = 'Pendiente'`, ordenada por `nivel_urgencia` (Alta → Media → Baja), con el nombre del insumo, `fecha_esperada` y proveedores sugeridos.

## Columnas
Insumo, cantidad solicitada, urgencia, fecha tope, proveedor(es) sugerido(s).

## Impresión
- CSS `@media print` oculta sidebar, navbar y cualquier control de UI — en la hoja impresa solo queda la tabla.
- Las alertas de color por `nivel_urgencia` son solo para pantalla. En la versión impresa, marca la urgencia también con algo que se distinga en blanco y negro (negrita, un ícono o una etiqueta de texto) — no dependas solo del color, muchas impresoras de oficina imprimen en escala de grises.
