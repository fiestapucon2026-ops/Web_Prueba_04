# Instrucciones para el siguiente chat — Estado 100% operativo, fase estética

**Copia este contenido al inicio del nuevo chat.** Todo el flujo de entradas/tickets funciona 100%. La siguiente fase es solo aspectos estéticos.

---

## REGLAS DE ORO (OBLIGATORIAS)

1. **REGLA #1 — LA MÁS IMPORTANTE:** Los cambios **estéticos** no pueden modificar código que afecte al **sistema**. Sistema = flujo de pago, APIs, webhooks, tokens, seguridad, órdenes, tickets, Supabase, Mercado Pago. Estética = solo CSS, textos, imágenes, layout visual; sin tocar lógica ni rutas API ni flujos críticos.
2. **Respaldar antes de modificar:** Antes de tocar cualquier archivo, respaldar (ej. en `respaldo_pre_estetica_2026-02-03/` para trabajo estético: `cp src/app/ruta/archivo.tsx respaldo_pre_estetica_2026-02-03/nombre_antes_XXXX.bak`).

---

## ESTADO: 100% OPERATIVO (CONFIRMADO)

- **Proyecto:** web_oficial_festival — venta de entradas, Next.js 14+, TypeScript, Vercel, Supabase, Mercado Pago.
- **Deploy:** Producción en **www.festivalpucon.cl**. Deploy manual: `cd /home/lvc/web_oficial_festival && npx vercel deploy --prod`.
- **Módulo entradas/tickets:** **100% operativo.** Compra de prueba confirmada: Success → Mis entradas → tickets con QR visibles e imprimibles. Fallback vía by-reference + búsqueda MP funciona.
- **Fase actual:** Aspectos **estéticos** únicamente. No modificar código que afecte al sistema (regla de oro #1).

### Lo implementado en esta sesión

1. **Función compartida DRY:** `src/lib/orders/process-approved-order.ts`
   - Dado `external_reference` y `email`, lee órdenes `paid`, crea tickets (idempotente por `order_id`) y encola job PDF+email.
   - Usa `requireSupabaseAdmin()` internamente.

2. **Webhook refactorizado:** `src/app/api/webhooks/mercadopago/route.ts`
   - Tras UPDATE a paid llama a `processApprovedOrder()` (ya no duplica lógica).
   - Logs de debugging de firma: `data.id usado desde: query|body|ninguno` y **manifest entre pipes** `[Manifest Debug] |...|` para detectar espacios invisibles.
   - Sigue devolviendo 401 "Firma inválida" en notificaciones reales (MP_WEBHOOK_SECRET verificado 3 veces; causa atribuida a formato del manifest).

3. **Fallback en by-reference:** `src/app/api/orders/by-reference/route.ts`
   - Si órdenes pending: caché en memoria (TTL 15 s) con **limitación documentada** (serverless = best effort).
   - Si hay `payment_id` en query: prioriza `GET /v1/payments/{id}`; si no, `search` con `sort: 'date_created', criteria: 'desc'` y en código se toma el **primer resultado con status === 'approved'** (no solo `results[0]`).
   - UPDATE atómico; **solo si `updatedRows.length >= 1`** se llama a `processApprovedOrder` (comentario de concurrencia con webhook).
   - Re-fetch de órdenes paid y respuesta con tickets.

4. **Advertencias del experto aplicadas:**
   - Caché: comentario en código sobre limitación serverless.
   - MP search: orden descendente + filtrar primer `approved`; opcional `payment_id` en query.
   - Logging webhook: manifest entre pipes; origen de `data.id` (query/body).
   - processApprovedOrder: ya usaba admin interno (sin cambio).

---

## ARCHIVOS CLAVE

| Archivo | Rol |
|---------|-----|
| `src/lib/orders/process-approved-order.ts` | Función compartida: tickets + job_queue (idempotente). |
| `src/app/api/webhooks/mercadopago/route.ts` | Webhook MP; firma; logs manifest entre pipes; processApprovedOrder. |
| `src/app/api/orders/by-reference/route.ts` | Token + órdenes; fallback MP (caché, search/get, UPDATE atómico, processApprovedOrder). |
| `src/app/api/orders/access-token/route.ts` | Token para Mis entradas (acepta pending). |
| `src/app/mis-entradas/page.tsx` | Polling 6 s; token URL o sessionStorage. |
| `src/app/success/page.tsx` | Venta exitosa; enlace a Mis entradas. |
| `docs/MERCADOPAGO_WEBHOOK_URL.md` | URL webhook: https://www.festivalpucon.cl/api/webhooks/mercadopago |
| `SOLUCION_DEFINITIVA_TICKETS_WEBHOOK_POLLING.md` | Diseño de la solución híbrida (webhook + fallback). |
| `INFORME_EXPERTO_WEBHOOK_TICKETS_CALLEJON.md` | Informe para experto (firma inválida; secret verificado 3 veces). |

---

## RESPALDOS RECIENTES

- **Para trabajo estético:** `respaldo_pre_estetica_2026-02-03/` (entradas, success, mis-entradas, TicketSelector, CustomerForm, page, PantallaInicio).
- **Seguridad/OWASP:** `respaldo_pre_seguridad_owasp/` (create-preference, by-reference, access-token, webhook, process-tickets, RPC).
- **Tickets/QR:** `respaldo_pre_tickets_qr/` (rutas y páginas anteriores).

---

## QUÉ SE COMPLETÓ (CONFIRMADO)

- Deploy a producción exitoso (F4W74YJXg, www.festivalpucon.cl).
- Compra de prueba: Success → "Ver e imprimir mis entradas" → **tickets con QR visibles e imprimibles.** Todo funciona 100%.

---

## FASE ACTUAL: ASPECTOS ESTÉTICOS

- Trabajo permitido: **solo** cambios visuales (CSS, textos, imágenes, layout). Sin tocar APIs, webhooks, flujo de pago, tokens, seguridad ni lógica de órdenes/tickets.
- Regla de oro #1: ningún cambio estético puede modificar código que afecte al sistema.

---

## TAREAS POSIBLES PARA EL SIGUIENTE CHAT (SOLO ESTÉTICA)

- Ajustes de diseño, colores, tipografía, espaciado, imágenes, copy de textos.
- Respaldo antes de cualquier cambio; no tocar rutas API ni flujos críticos.

---

## VARIABLES DE ENTORNO CRÍTICAS (Vercel)

- `MP_WEBHOOK_SECRET`, `MP_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SIGNING_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_BASE_URL`

---

**Resumen para el asistente:** Todo el flujo de entradas/tickets está 100% operativo. La fase actual es **solo estética**. Regla de oro: cambios estéticos no pueden modificar código que afecte al sistema. **Para nuevo chat enfocado en estética:** usar documento `INSTRUCCIONES_NUEVO_CHAT_SOLO_ESTETICA.md`.
