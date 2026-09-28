---
name: mantenedor-crud
description: Estructura estándar de las pantallas CRUD (Mantenedores) del proyecto Okima — Proveedores, Insumos, Categorías y Subcategorías. Úsalo al construir cualquiera de estas pantallas en la Fase 4.
---

# Mantenedor CRUD

Estructura común para las pantallas de gestión de `proveedores`, `insumos_proveedores`, `insumos`, `categorias` y `subcategorias`. `categorias` son los centros de costo y `subcategorias` su desglose (cada una con su `id_categoria`); en `insumos` se elige solo la subcategoría.

## Layout
1. Tabla con los registros, con botón de exportar a CSV — es un componente reutilizable, impleméntalo una sola vez y compártelo entre todos los Mantenedores, no lo repitas por pantalla.
2. Formulario de creación/edición con los campos de la tabla según `CLAUDE.md`.
3. Filtro "Incompletos": registros donde falte algún dato que quedó vacío por la creación al vuelo (ver skill `creacion-al-vuelo`). Sirve para que el administrador los vaya completando.

## Caso especial: Gestionar Proveedores y sus Insumos
Además de lo anterior, incluye la vista "Insumos por vincular": `insumos_proveedores` con `id_insumo_okima` vacío, con un selector directo para asignarlo ahí mismo. Es el único lugar de toda la app donde se hace este vínculo — pensado para la revisión semanal del administrador, no para uso diario.

## Estilo
Tailwind puro o componentes tipo shadcn/ui, iconos de `lucide-react`. Mantén el mismo layout de tabla, formulario y filtros entre los distintos Mantenedores — no reinventar la estructura en cada uno.
