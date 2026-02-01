# Resumen para nuevo chat — Módulo Entradas + MP + Promo

**Pega este bloque como primer mensaje en un nuevo chat para continuar con contexto limpio.**

---

## Estado del módulo

- **Este módulo está 100% operativo.** Flujo de compra (entrada + estacionamiento + promo), stock, MP, webhook, órdenes y tickets funcionan correctamente.
- **Solo quedan temas estéticos** (colores, textos, espaciados, etc.). No cambiar lógica ni flujos sin acuerdo explícito.

---

## Proyecto

- **Nombre:** web_oficial_festival (Festival Pucón 2026).
- **Stack:** Next.js 14+, TypeScript (strict), Tailwind, Vercel, Mercado Pago, Supabase.
- **Dominio producción:** www.festivalpucon.cl (DNS → Vercel; el repo es la fuente del contenido).

---

## ⚠️ Temas críticos que NO debe tocar (doble ratificación)

- **Página de inicio** (`/`, PantallaInicio): no modificar salvo acuerdo explícito.
- **APIs de entradas y tickets:** `/api/entradas/inventory`, `/api/entradas/create-preference`, `/api/tickets/create-preference`. No alterar lógica de stock, preferencia MP ni órdenes.
- **Webhook Mercado Pago:** `/api/webhooks/mercadopago`. No alterar flujo de actualización de órdenes ni creación de filas en `tickets`.
- **Esquema de BD:** tablas `orders`, `tickets`, `inventory`, `daily_inventory`, `event_days`; columna `orders.quantity`; varias órdenes por mismo `external_reference`. No cambiar sin migración acordada.
- **Flujo de pago:** delegación 1 ítem → `/api/tickets/create-preference`; varios ítems → preferencia MP directa. No tocar sin acuerdo.
- **Regla de oro:** Este módulo no se toca salvo acuerdo explícito; solo ajustes estéticos permitidos sin doble ratificación.

---

## Qué está hecho en este módulo

1. **Página /entradas:** Selector de fecha → selector de tickets (Familiar / Todo el Día + cantidad 1–8) → estacionamiento opcional (Normal / VIP) → **promo opcional** "Promo 2x1 Cerveza Artesanal (2 x 500 cc)" con cantidad 1..N (N = cantidad de entradas). Declaración de mayoría de edad obligatoria para la promo (modal SÍ/NO); si NO, botón promo deshabilitado hasta que pulse "Acepto y declaro ser mayor de edad (SÍ)".
2. **Stock y mensajes:** Cálculo desde BD (inventory, orders); "AGOTADOS" cuando `available_stock < 1`; "¡¡ ULTIMAS UNIDADES !!" cuando `occupied_pct >= fomo_threshold`.
3. **APIs:** `GET /api/entradas/inventory?date=YYYY-MM-DD`; `POST /api/entradas/create-preference` (ítems: entrada + parking + promo; un ítem → delega a `/api/tickets/create-preference`; varios → preferencia MP directa). Órdenes con `quantity`; varias órdenes por mismo `external_reference`.
4. **Webhook:** `POST /api/webhooks/mercadopago` actualiza todas las órdenes por `external_reference`, crea filas en tabla `tickets` (una por unidad, status `sold_unused`, `discount_amount` 0), genera PDF y envía email por orden.
5. **BD:** Tabla `tickets` (id, order_id, inventory_id, status, discount_amount, created_at, used_at). Columna `orders.quantity`. Migración para permitir varias órdenes por `external_reference`. Seed con tipo promo y su inventario por evento/fecha.
6. **Página /success:** Redirección configurable (`NEXT_PUBLIC_SUCCESS_REDIRECT_URL`, `NEXT_PUBLIC_SUCCESS_REDIRECT_SECONDS`) a www.festivalpucon.cl o a futura "mis entradas". `auto_return` en producción cuando base URL es festivalpucon.

---

## Archivos clave

- **Front:** `src/app/entradas/page.tsx`, `src/components/checkout/TicketSelector.tsx`, `src/components/checkout/CustomerForm.tsx`, `src/app/success/page.tsx`.
- **APIs:** `src/app/api/entradas/inventory/route.ts`, `src/app/api/entradas/create-preference/route.ts`, `src/app/api/tickets/create-preference/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`.
- **BD:** `supabase/migrations/` (orders_allow_multiple_per_external_reference.sql, orders_quantity_and_tickets_table.sql), `supabase/seed.ts`.
- **Docs:** `MODULO_ENTRADAS_MP_RESUMEN.md`, `OPERATIVAR_MODULO_ENTRADAS.md`, `.env.example`.

---

## Pendiente / siguiente módulo

- Ventana "Pago exitoso" ya existe (`/success`); configurar redirección a "mis entradas" cuando exista esa ruta.
- **Módulo siguiente:** Emails a clientes y generación de tickets con QR; datos disponibles en `orders` + `tickets` + `inventory` (ver `MODULO_ENTRADAS_MP_RESUMEN.md`).
- Marcar tickets como "utilizado" (status `used`, `used_at`) vía escaneo/API en puerta.
- Uso de `tickets.discount_amount` para promos con regalo ($5.000, $10.000, etc.) cuando se defina el flujo.

---

## Cómo seguir

- Para **cambios en este módulo:** solo temas estéticos sin acuerdo; todo lo crítico (inicio, APIs, webhook, BD, flujo de pago) requiere doble ratificación.
- Para **nuevo módulo (emails, tickets con QR):** usar `MODULO_ENTRADAS_MP_RESUMEN.md` y este resumen como contexto; no modificar lógica de entradas/create-preference/webhook sin acuerdo.
