# Plan: Reactivar módulo Tickets con QR y email

**Objetivo:** Poner en marcha tickets con QR y email **sin tocar** (o tocando lo mínimo y siempre con respaldo) los archivos que unen Entradas y MP.

**Regla de oro:** Antes de modificar cualquier archivo de otro módulo → respaldo de ese archivo. Luego modificar. Si falla → restaurar desde respaldo.

---

## 1. Archivos NO TOCAR (puente Entradas ↔ MP)

| Archivo | Motivo |
|---------|--------|
| `src/app/api/entradas/create-preference/route.ts` | Crea preferencia MP para Entradas; cualquier cambio ya provocó 502 y desconexión. |
| `src/app/api/tickets/create-preference/route.ts` | Usado por Entradas (1 ítem); mismo riesgo. |
| `src/app/success/page.tsx` | Redirige tras pago; ya tiene lógica token → /mis-entradas. No modificar para no reintroducir regresión. |

Si en el futuro se debe tocar alguno: **backup previo obligatorio** en `respaldo_pre_tickets_qr/` y probar de inmediato Entradas → Continuar → que no aparezca 502.

---

## 2. Estado actual del flujo Tickets (sin tocar los 3 de arriba)

- **Webhook** (`src/app/api/webhooks/mercadopago/route.ts`): ya usa `createAccessToken`, `sendPurchaseEmail`, agrupa por `external_reference`, genera PDF con `generateTicketsPDF`. ✅
- **Success** (`src/app/success/page.tsx`): ya lee `external_reference` y `status=approved`, hace polling a `/api/orders/access-token`, redirige a `/mis-entradas?token=`. ✅
- **APIs:** `access-token`, `by-reference`, `by-reference/pdf` existen y están en uso. ✅
- **Página** `/mis-entradas`: existe, usa token, muestra TicketCards y descarga PDF. ✅
- **Create-preference (entradas y tickets):** restaurados; no envían `auto_return` en todos los entornos ni cambian default de baseUrl de forma que rompa MP. ✅

Conclusión: el **flujo de tickets (QR + email)** ya está implementado en código. Lo que se revirtió fue solo create-preference y success en su momento; la success actual ya tiene de nuevo la redirección a mis-entradas. Por tanto, “reactivar” = **no tocar** los 3 archivos puente y **verificar** que el resto funcione con env correcto.

---

## 3. Pasos para reactivar (sin tocar puente)

### 3.1 Verificación (sin ejecutar código en producción)

- [ ] Confirmar que en Vercel/Preview están configuradas: `QR_SIGNING_SECRET`, `RESEND_API_KEY`, `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`.
- [ ] Dominio Resend: que el dominio del remitente (ej. `noreply@festivalpucon.cl`) esté verificado en Resend para que el email llegue.
- [ ] Webhook MP: que la URL del webhook (ej. `https://www.festivalpucon.cl/api/webhooks/mercadopago` o la preview) esté registrada en el dashboard de MP y reciba eventos.

### 3.2 Prueba E2E (cuando decidas ejecutar)

1. Hacer una compra de prueba desde `/entradas` (1 ítem, MP sandbox).
2. Tras aprobar en MP, comprobar que:
   - Llegas a `/success?external_reference=...&status=approved`.
   - La página hace polling y muestra "Ver mis entradas" y/o redirige a `/mis-entradas?token=...`.
   - En `/mis-entradas` se ven las TicketCards con QR.
   - El botón "Descargar PDF" devuelve un PDF con QR real.
3. Comprobar que se recibe **un** email con enlace "Ver y descargar mis entradas" y, si aplica, PDF adjunto.

Si algo falla, el fallo estará en **webhook, access-token, by-reference, pdf, email o mis-entradas**, no en create-preference ni success. Esos últimos **no se tocan**.

### 3.3 Si hubiera que corregir algo (solo en la cadena tickets)

Archivos que **sí** se pueden tocar, **siempre con respaldo previo**:

| Archivo | Respaldo sugerido |
|---------|-------------------|
| `src/app/api/webhooks/mercadopago/route.ts` | `respaldo_pre_tickets_qr/webhooks_mercadopago_route.ts.bak` (ya existe .bak) |
| `src/app/api/orders/access-token/route.ts` | Crear .bak antes de editar |
| `src/app/api/orders/by-reference/route.ts` | Crear .bak antes de editar |
| `src/app/api/orders/by-reference/pdf/route.ts` | Crear .bak antes de editar |
| `src/lib/pdf.tsx` | `respaldo_pre_tickets_qr/pdf.tsx.bak` (ya existe) |
| `src/lib/email.ts` | `respaldo_pre_tickets_qr/email.ts.bak` (ya existe) |
| `src/app/mis-entradas/page.tsx` | Crear .bak antes de editar |

Regla: **un cambio a la vez**, probar, y si algo rompe Entradas o create-preference, no seguir; revisar qué se tocó.

---

## 4. Resumen ejecutivo

- **No tocar:** `entradas/create-preference`, `tickets/create-preference`, `success/page.tsx`.
- **Reactivar =** dejar esos tres intactos y asegurar env + webhook + dominio Resend; luego probar E2E. El flujo de tickets (QR + email) ya está en el código.
- **Regla de oro:** respaldo de cualquier archivo de otro módulo antes de modificarlo; restaurar si falla.

Cuando quieras, el siguiente paso concreto es: revisar env y webhook en Vercel/Resend (sin tocar código) y luego hacer una compra de prueba siguiendo el checklist E2E.
