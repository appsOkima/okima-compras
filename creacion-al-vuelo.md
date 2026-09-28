---
name: creacion-al-vuelo
description: Patrón de combobox con autocompletado + creación inline para insumo_okima, proveedor e insumo_proveedor en el proyecto Okima. Úsalo al construir cualquier selector de estas tres entidades en Solicitudes de Compra o Gestionar Facturas.
---

# Creación al vuelo

Patrón de UX para seleccionar `insumo_okima`, `proveedor` o `insumo_proveedor` sin salir del formulario donde se están usando.

## Comportamiento
1. El input es un combobox con autocompletado que busca sobre los registros existentes por `nombre`, sin distinguir mayúsculas, tildes ni espacios extra.
2. Si hay una coincidencia exacta o muy cercana, se muestra como opción para seleccionar — no crear.
3. Si el texto escrito no calza con nada, se ofrece la opción "Crear '<texto>'". Al elegirla, se crea el registro con ese texto como `nombre` (más los campos adicionales obligatorios de cada caso, ver abajo). El resto de los campos queda `null`.

## Campos obligatorios por entidad
- **`insumo_okima`** (desde Solicitudes de Compra): `nombre` + `id_categoria` (dropdown de categorías existentes, obligatorio — no se puede crear sin categoría).
- **`proveedor`** (desde Gestionar Facturas): primero `nombre` (para verificar si ya existe), luego `rut` (obligatorio, se necesita para facturar). El resto queda nulo.
- **`insumo_proveedor`** (desde Gestionar Facturas): `nombre`, hereda `id_proveedor` del proveedor ya seleccionado en esa factura. **`id_insumo_okima` NO se pide aquí — nunca se vincula al vuelo.** Ese vínculo lo hace solo el administrador desde Gestionar Proveedores y sus Insumos.

## Qué no hacer
- No crear un registro nuevo si ya existe uno con nombre igual o muy similar (typo, mayúsculas, tildes) — avisar antes de crear, no crear en silencio.
- No agregar restricción `UNIQUE` a nivel de base de datos sobre `nombre` — el chequeo de duplicados es de aplicación, no de base de datos.
- No ofrecer vincular `insumo_okima` al crear un `insumo_proveedor`, bajo ninguna circunstancia.
