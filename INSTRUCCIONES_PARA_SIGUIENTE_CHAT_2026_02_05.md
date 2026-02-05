# Instrucciones para el siguiente chat — Estado 2026-02-05 (Pago on-site Bricks)

**Copia este contenido al inicio del nuevo chat.** Documento de traspaso con lo avanzado en esta sesión y lo pendiente.

---

## 1. REGLAS DE ORO (OBLIGATORIAS)

1. **REGLA #1:** Los cambios **estéticos** no pueden modificar código que afecte al **sistema** (flujo de pago, APIs, webhooks, tokens, seguridad, órdenes, tickets, Supabase, Mercado Pago). Estética = solo CSS, textos, imágenes, layout; sin tocar lógica ni rutas API.
2. **Protocolo doble confirmación** (`.cursorrules`): Fase 1 Análisis → Fase 2 Propuesta → pedir "Autorización para ejecutar" → Fase 3 Ejecución solo tras "Autorizado/Proceder".
3. **Respaldar antes de modificar:** Usar carpetas `respaldo_*` existentes o crear nueva con copia del archivo antes de cambiar.
4. **Preferencia de documentos:** No generar documentos de pasos para el usuario (tipo `PASOS_*.md`) salvo que pida **explícitamente** un documento. Los recordatorios/instrucciones para traspaso de chat sí se mantienen actualizados.

---

## 2. QUÉ SE HIZO EN ESTA SESIÓN (PAGO ON-SITE / BRICKS)

### Objetivo
Permitir pago como invitado en todos los dispositivos (incl. Android/Galaxy con app MP instalada), evitando que el checkout abra la app de MP y obligue a iniciar sesión. Solución: **pago on-site** con Card Payment Brick (Bricks) en la propia web.

### Implementado

- **Respaldo:** `respaldo_checkout_pro/` — copias de `api/tickets/create-preference`, `api/entradas/create-preference`, y páginas `tickets/page.tsx`, `entradas/page.tsx` (flujo Checkout Pro).
- **Nuevas rutas:**
  - `POST /api/tickets/reserve` — Reserva órdenes, devuelve `external_reference`, `transaction_amount`, `payer_email`, `payment_data_token` (token de un solo uso).
  - `POST /api/entradas/reserve` — Igual; con 1 ítem delega en tickets/reserve.
  - `GET /api/orders/payment-data?token=` — Valida y consume el token una vez; devuelve monto y email para el Brick.
  - `POST /api/orders/create-payment` — Recibe token del Brick + external_reference + payer_email; crea pago con Payments API de MP; devuelve `redirect_url` (success/pending/failure con `?external_reference=...`).
- **Página `/pago`:** Carga Card Payment Brick (`@mercadopago/sdk-react`). Recibe `?token=payment_data_token`, llama a payment-data, muestra formulario de tarjeta; al enviar llama create-payment y redirige. Envuelta en `Suspense` por `useSearchParams`.
- **Switch en flujo:** Si está definido `NEXT_PUBLIC_MP_PUBLIC_KEY`, las páginas **tickets** y **entradas** usan **reserve** y redirigen a `/pago?token=...`. Si no, siguen usando **create-preference** y `init_point` (Checkout Pro).
- **Seguridad:** Token de un solo uso firmado con `MP_PAYMENT_DATA_SECRET` (HMAC, nonce consumido en `idempotency_keys`). Create-payment no loguea body ni token.
- **Variables de entorno (Vercel):**
  - `NEXT_PUBLIC_MP_PUBLIC_KEY` — Clave **pública** de MP (Panel MP → Credenciales → Clave pública). Diseñada para usarse en el navegador; la advertencia de Vercel puede ignorarse.
  - `MP_PAYMENT_DATA_SECRET` — Secret **propio** (no viene de MP). Generar con `openssl rand -hex 32` y añadir en Vercel. Usado para firmar el token de payment-data.
- **Documentación:** `.env.example` actualizado; `docs/MIGRACION_PAGO_ONSITE_ANALISIS_Y_PLAN.md` con análisis, riesgos e implementación realizada.

### Archivos clave nuevos/modificados

| Archivo | Rol |
|---------|-----|
| `src/app/api/tickets/reserve/route.ts` | Reserva tickets; devuelve payment_data_token. |
| `src/app/api/entradas/reserve/route.ts` | Reserva entradas (delega o multi-ítem). |
| `src/app/api/orders/payment-data/route.ts` | GET con token; consume nonce; devuelve amount + payer_email. |
| `src/app/api/orders/create-payment/route.ts` | POST; crea Payment en MP; no loguear token. |
| `src/lib/security/payment-data-token.ts` | Crear/verificar token un solo uso (HMAC + nonce). |
| `src/app/pago/page.tsx` | Página con Card Payment Brick; Suspense + useSearchParams. |
| `src/app/tickets/page.tsx` | Switch: si PUBLIC_KEY → reserve + /pago; si no → create-preference. |
| `src/app/entradas/page.tsx` | Idem. |

---

## 3. DEPLOY EN VERCEL

- **Cuándo ocurre el próximo deploy:** Los deploys se crean **automáticamente** al hacer **push** a la rama conectada (ej. `main` de `Web_Prueba_04`). **Añadir solo variables de entorno no lanza un nuevo deploy.**
- **Para que las nuevas variables se usen ya:** En Vercel → **Deployments** → menú (tres puntos) del último deploy → **Redeploy**. Así se vuelve a construir con `NEXT_PUBLIC_MP_PUBLIC_KEY` y `MP_PAYMENT_DATA_SECRET`.

---

## 4. QUÉ FALTA POR HACER

1. **Redeploy manual** en Vercel (si aún no se hizo) para que el build use las nuevas variables.
2. **Probar flujo pago on-site:** Desde **Entradas** o **Tickets**, iniciar una compra; debe redirigir a **/pago** y mostrar el formulario de tarjeta (Brick) en el sitio. Completar pago de prueba y verificar: redirect a success/pending/failure, webhook actualiza órdenes, PDF/email si aplica.
3. **Opcional:** Ajustes estéticos en `/pago` (textos, layout) sin tocar lógica ni APIs.

---

## 5. VARIABLES DE ENTORNO (Vercel) — LISTA ACTUAL

- `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MP_PUBLIC_KEY` (clave pública MP; para Bricks)
- `MP_PAYMENT_DATA_SECRET` (secret propio; para token payment-data)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `QR_SIGNING_SECRET`, `CRON_SECRET`, `ADMIN_SECRET`
- Opcionales: `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## 6. ROLLBACK PAGO ON-SITE

Si se quiere volver solo a Checkout Pro: en Vercel, **borrar** o dejar **vacía** la variable `NEXT_PUBLIC_MP_PUBLIC_KEY` y hacer **Redeploy**. El código sigue teniendo create-preference y redirección a `init_point`; sin public key se usa ese flujo.

---

## 7. DOCUMENTOS DE REFERENCIA

- **Estado general / estética:** `INSTRUCCIONES_PARA_SIGUIENTE_CHAT_FINAL.md`
- **Migración pago on-site:** `docs/MIGRACION_PAGO_ONSITE_ANALISIS_Y_PLAN.md`
- **MP pago sin cuenta Android:** `docs/MERCADOPAGO_PAGO_SIN_CUENTA_ANDROID.md`
- **Control de acceso QR (informe para experto):** `INFORME_EXPERTO_CONTROL_ACCESO_QR.md` — implementación, errores, punto muerto y solicitud de alternativas (lectura cámara no viable; validación manual OK). **URL producción:** https://www.festivalpucon.cl/admin/validar-qr
- **Reglas del proyecto:** `.cursorrules`

---

**Resumen para el asistente:** Se implementó pago on-site (Bricks) con reserve, payment-data, create-payment y página /pago. Variables `NEXT_PUBLIC_MP_PUBLIC_KEY` y `MP_PAYMENT_DATA_SECRET` ya creadas en Vercel. Falta redeploy manual y prueba del flujo. Reglas de oro: no modificar sistema en cambios estéticos; doble confirmación antes de ejecutar código.
