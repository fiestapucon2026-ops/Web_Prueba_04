# Checklist E2E — Módulo Tickets QR + Email

Pruebas end-to-end del flujo: compra MP sandbox → webhook → email → /mis-entradas → PDF con QR.

---

## Pre-requisitos

### Variables de entorno (`.env.local` o Vercel)

| Variable | Requerido | Nota |
|----------|-----------|------|
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Para webhook y APIs orders |
| `MP_ACCESS_TOKEN` | ✅ | Token TEST- para sandbox |
| `MP_WEBHOOK_SECRET` | ✅ | Firma del webhook MP |
| `RESEND_API_KEY` | ✅ | Envío del email único |
| `QR_SIGNING_SECRET` | ✅ | Firma QR y token "Mis entradas" |
| `NEXT_PUBLIC_BASE_URL` | ✅ | URL accesible para webhook (ngrok si local) |

### Webhook accesible desde MP

- **Local:** Usar [ngrok](https://ngrok.com) o similar: `ngrok http 3000` → usar URL pública como `NEXT_PUBLIC_BASE_URL`
- **Vercel Preview:** La URL del deploy ya es pública; configurar webhook en MP apuntando a `https://tu-preview.vercel.app/api/webhooks/mercadopago`

### Datos en Supabase

- Tablas: `events`, `ticket_types`, `inventory`, `orders`, `tickets`
- Al menos un evento con inventario disponible
- Ver `CHECKLIST_PRE_PRUEBA.md` o `GUIA_INSERCION_DATOS.md`

---

## Paso 1: Comprobar env y API base

```bash
# Cargar env (si usas .env.local, Next.js lo carga automáticamente)
source .env.local 2>/dev/null || true

# Verificar variables críticas
node scripts/check-env.js

# Verificar API de tickets (inventario disponible)
npm run verify:api

# Verificar build
npm run build
```

- [ ] `check-env.js` sin errores de variables requeridas
- [ ] `verify:api` OK (ticket_types, events, inventory)
- [ ] Build OK

---

## Paso 2: Iniciar servidor y exponer webhook

```bash
npm run dev
```

Si estás en local y MP debe llamar al webhook:
```bash
# En otra terminal
ngrok http 3000
# Copiar URL HTTPS (ej. https://abc123.ngrok.io) y ponerla en:
# - NEXT_PUBLIC_BASE_URL (temporal para prueba)
# - Webhook en MP: https://abc123.ngrok.io/api/webhooks/mercadopago
```

- [ ] Servidor corriendo
- [ ] Webhook URL accesible desde internet (ngrok o Vercel)

---

## Paso 3: Compra de prueba en Mercado Pago

1. Ir a `/tickets` o `/entradas` (según el flujo activo)
2. Seleccionar evento y tipo de ticket
3. Usar email de prueba (ej. `test_user_123@testuser.com`)
4. Completar pago en MP sandbox:
   - **Tarjeta de prueba MP:** `5031 4332 1540 6351`
   - **Vencimiento:** cualquiera futuro
   - **CVV:** `123`
   - **Titular:** `APRO` (aprueba), `CONT` (pendiente), `OTRE` (rechazado)
5. Tras aprobar, MP redirige a `/success?external_reference=XXX&status=approved`

- [ ] Redirección a /success con `external_reference` y `status=approved` en la URL

---

## Paso 4: Verificar redirección a /mis-entradas

En `/success`, la página debe:
- Mostrar "Pago exitoso"
- Contar regresiva
- Obtener token desde `/api/orders/access-token?external_reference=XXX`
- Redirigir a `/mis-entradas?token=XXX` al terminar la cuenta

- [ ] Cuenta regresiva visible
- [ ] Botón "Ver mis entradas" enlaza a `/mis-entradas?token=...`
- [ ] Tras esperar, redirección automática a /mis-entradas

---

## Paso 5: Verificar página /mis-entradas

1. Abrir `/mis-entradas?token=XXX` (el token viene del paso anterior)
2. Debe mostrar:
   - Título "Mis entradas"
   - Cantidad de entradas
   - Una `TicketCard` por cada ticket (con QR real)
   - Botón "Descargar PDF (todas las entradas)"

- [ ] Página carga sin error
- [ ] Se muestran las TicketCards con QR (no placeholder)
- [ ] Botón "Descargar PDF" visible

---

## Paso 6: Verificar PDF descargado

1. Clic en "Descargar PDF (todas las entradas)"
2. Se descarga un PDF con una página por ticket
3. Cada página debe tener:
   - Información del evento
   - **QR real** (imagen escaneable, no texto)
   - Datos de la compra

- [ ] PDF se descarga
- [ ] QR es imagen escaneable (probar con app lectora QR)
- [ ] Cada ticket tiene su propio QR (identifica `ticket.id`)

---

## Paso 7: Verificar email recibido

Tras la compra aprobada, el webhook envía **un solo email** a `payment.payer.email` (o fallback `orders[0].user_email`) con:

- Asunto: "Tu compra — Festival Pucón 2026"
- Resumen de ítems comprados
- Enlace "Ver y descargar mis entradas" → `/mis-entradas?token=XXX`
- Adjunto: PDF con todos los tickets (opcional según implementación)

- [ ] Se recibe 1 email (no uno por orden)
- [ ] Enlace en el email funciona
- [ ] PDF adjunto contiene QR real (si se adjuntó)

---

## Paso 8: Verificar webhook y tickets en BD

En Supabase:

```sql
-- Última compra (ajustar external_reference si sabes cuál)
SELECT o.id, o.external_reference, o.status, o.user_email, o.quantity
FROM orders o
WHERE o.status = 'paid'
ORDER BY o.created_at DESC
LIMIT 5;

-- Tickets creados para esas órdenes
SELECT t.id, t.order_id, t.status
FROM tickets t
JOIN orders o ON o.id = t.order_id
WHERE o.status = 'paid'
ORDER BY t.created_at DESC
LIMIT 10;
```

- [ ] Órdenes con `status = 'paid'`
- [ ] Filas en `tickets` (una por unidad por orden)
- [ ] `ticket.id` es UUID único por entrada

---

## Paso 9: Script de verificación (sin flujo MP)

Si ya tienes una orden pagada con `external_reference` conocido:

```bash
# Obtener token y probar APIs (sustituir EXTERNAL_REF con un UUID real)
EXTERNAL_REF="tu-external-reference-uuid"
BASE="http://localhost:3000"

# 1. Obtener token
TOKEN=$(curl -s "${BASE}/api/orders/access-token?external_reference=${EXTERNAL_REF}" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).token)")
echo "Token: ${TOKEN:0:20}..."

# 2. Probar by-reference
curl -s "${BASE}/api/orders/by-reference?token=${TOKEN}" | head -c 200

# 3. Descargar PDF (guarda en /tmp)
curl -s "${BASE}/api/orders/by-reference/pdf?token=${TOKEN}" -o /tmp/entradas-test.pdf
ls -la /tmp/entradas-test.pdf
```

- [ ] access-token devuelve `{ "token": "..." }`
- [ ] by-reference devuelve órdenes y tickets
- [ ] PDF se genera y tiene tamaño > 0

---

## Resumen rápido

| Paso | Qué verificar |
|------|---------------|
| 1 | Env, API, build |
| 2 | Servidor + webhook accesible |
| 3 | Compra MP → redirección a /success |
| 4 | /success → token → redirección a /mis-entradas |
| 5 | /mis-entradas muestra TicketCards con QR |
| 6 | PDF descargable con QR real |
| 7 | 1 email con enlace y adjunto |
| 8 | Órdenes paid, tickets en BD |
| 9 | Script verificación APIs |

---

## Problemas frecuentes

| Síntoma | Posible causa |
|---------|---------------|
| Webhook no recibe evento | MP no puede alcanzar la URL; usar ngrok o Vercel |
| Email no llega | `RESEND_API_KEY` faltante o dominio no verificado |
| 500 en access-token | `QR_SIGNING_SECRET` no configurado |
| 404 en by-reference | Token inválido o expirado (TTL 7 días) |
| PDF sin QR | Revisar que `qrcode` esté instalado y `signTicket(ticket.id, ...)` se use |
| Varios emails | Webhook antiguo; verificar que use `sendPurchaseEmail` y no bucle por orden |
