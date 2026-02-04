# Instrucciones para el siguiente chat — Módulo Tickets 100% operativo, fase estética

**Copia todo este contenido al inicio del nuevo chat.** Documento de referencia; el documento principal actualizado es `INSTRUCCIONES_PARA_SIGUIENTE_CHAT_FINAL.md`.

---

## REGLAS DE ORO (OBLIGATORIAS)

1. **REGLA #1 — LA MÁS IMPORTANTE:** Los cambios **estéticos** no pueden modificar código que afecte al **sistema** (flujo de pago, APIs, webhooks, tokens, seguridad, órdenes, tickets). Estética = solo CSS, textos, imágenes, layout.
2. **Respaldar antes de modificar:** Respaldos en `respaldo_pre_tickets_qr/` (ej.: `cp src/app/mis-entradas/page.tsx respaldo_pre_tickets_qr/mis_entradas_antes_XXXX.bak`).

---

## ESTADO: 100% OPERATIVO (CONFIRMADO)

- **Proyecto:** web_oficial_festival — venta de entradas con Mercado Pago, Next.js 14+, TypeScript, Vercel, Supabase.
- **Deploy:** Producción en **www.festivalpucon.cl**. Despliegue manual: `npx vercel deploy --prod`.
- **Módulo Tickets QR:** 100% operativo. Compra de prueba confirmada: Success → Mis entradas → tickets con QR visibles e imprimibles. Fallback vía by-reference + búsqueda MP operativo.
- **Fase actual:** Solo aspectos **estéticos**. No modificar código que afecte al sistema (regla de oro #1).

---

## VENTANA "VENTA EXITOSA" — YA CORRECTO (NO TOCAR SALVO RESPALDO)

- En **`/success`** (Venta exitosa) **no hay tiempo ni countdown**. El cliente elige:
  - **Ver e imprimir mis entradas** (enlace a `/mis-entradas?token=...`)
  - **Volver al inicio**
  - **Comprar más entradas**
- Código en `src/app/success/page.tsx`. No hay redirección automática; el usuario decide.

---

## RESUELTO: MIS ENTRADAS OPERATIVO

- Flujo Success → Mis entradas → tickets con QR confirmado 100%. Token (URL y/o sessionStorage), by-reference con fallback MP y processApprovedOrder operativos.
- Variables críticas en Vercel: `QR_SIGNING_SECRET`, `CRON_SECRET`, `MP_WEBHOOK_SECRET`, `MP_ACCESS_TOKEN`, `SUPABASE_*`, `NEXT_PUBLIC_BASE_URL`.

---

## ARCHIVOS CLAVE

| Archivo | Rol |
|---------|-----|
| `src/app/success/page.tsx` | Venta exitosa: sin tiempo, 3 botones (Ver e imprimir / Volver al inicio / Comprar más). |
| `src/app/mis-entradas/page.tsx` | Mis entradas: usa `token` de la URL, llama a `by-reference`; muestra "Error al cargar" si la petición falla. |
| `src/app/api/orders/access-token/route.ts` | Devuelve `{ token }` para external_reference o payment_id. Requiere `QR_SIGNING_SECRET`. |
| `src/app/api/orders/by-reference/route.ts` | Devuelve órdenes y tickets por token (verifica con `verifyAccessToken`). |
| `src/lib/security/access-token.ts` | Crea/verifica token (payload + firma HMAC, TTL 7 días). |
| `src/app/api/webhooks/mercadopago/route.ts` | Webhook MP: encola job en `job_queue`. |
| `src/app/api/workers/process-tickets/route.ts` | Worker: procesa cola, PDF a Storage, envía email. Protegido con `CRON_SECRET`. |

---

## RESUMEN PARA EL ASISTENTE

- **Todo el flujo de entradas/tickets está 100% operativo.** Fase actual: solo aspectos **estéticos**.
- **Regla de oro #1:** Los cambios estéticos no pueden modificar código que afecte al sistema (APIs, webhooks, flujo de pago, tokens, seguridad).
- **Respaldo antes de cualquier cambio.** Documento principal actualizado: `INSTRUCCIONES_PARA_SIGUIENTE_CHAT_FINAL.md`.
