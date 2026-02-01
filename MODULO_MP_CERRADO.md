# MÓDULO MERCADO PAGO — CERRADO (NO MODIFICAR)

**Estado:** CERRADO. Primera compra de prueba exitosa completada.  
**Fecha de cierre:** 2026-01-29.  
**Regla:** Este módulo **NO se modifica**. Cualquier cambio en flujo de pago, preferencia, webhook o idempotencia se hace en un módulo distinto o con autorización explícita y documentada.

---

## 1. INSTRUCCIÓN OBLIGATORIA

**Este módulo NO se modifica.**

- No editar código ni flujo de: create-preference, webhook mercadopago, idempotencia, páginas success/failure/pending, página /tickets (flujo de compra).
- No tocar la página de inicio (`src/app/page.tsx`, `src/components/pantalla-inicio/PantallaInicio.tsx`) hasta que se decida en otro proceso.
- Trabajo futuro (p. ej. email real, enlace desde la home) se hace en **módulos independientes**, sin alterar este flujo validado.

---

## 2. LO QUE SE LOGRÓ (ESTADO FINAL)

- **Compra de prueba exitosa:** En Preview, flujo completo: `/tickets` → preferencia MP (sandbox_init_point con token TEST-) → checkout MP (cuenta + tarjeta de prueba) → pago aprobado → redirección a `/success`. Orden en Supabase con `status: paid` y `mp_payment_id`.
- **URL de prueba (Preview):** `https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app` (confirmar en Vercel → Deployments → Domains si cambia).
- **Rama:** `feature/mercado-pago-payment`. Repo: fiestapucon2026-ops/Web_Prueba_04. Vercel: proyecto web_oficial_festival, equipo fiesta-pucons-projects.

---

## 3. ELEMENTOS TÉCNICOS IMPORTANTES (NO TOCAR)

| Área | Ubicación | Nota |
|------|-----------|------|
| Create preference | `src/app/api/tickets/create-preference/route.ts` | sandbox_init_point cuando MP_ACCESS_TOKEN empieza por TEST-; unit_price entero CLP; idempotencia con tabla idempotency_keys. |
| Webhook MP | `src/app/api/webhooks/mercadopago/route.ts` | Firma HMAC (x-signature, data.id desde query); payment.get como fuente de verdad; external_reference para orden; update atómico pending→paid. |
| Idempotencia en BD | Tabla `public.idempotency_keys` | Migración: `supabase/migrations/idempotency_fix.sql`. Columnas: id, key, init_point, external_reference, response_body, created_at. RLS solo service_role. |
| Página tickets | `src/app/tickets/page.tsx` | Selector evento/tipo, email, botón "Usar email de prueba MP", Idempotency-Key en POST. |
| Páginas retorno | `src/app/success/page.tsx`, `failure/page.tsx`, `pending/page.tsx` | back_urls de MP. |
| Tipos/API | `src/app/api/tickets/types/route.ts` | Eventos sin filtrar por fecha para dropdown. |
| Lib | `src/lib/mercadopago.ts`, `src/lib/supabase.ts`, `src/lib/schemas.ts` | Cliente MP, Supabase (admin preferido), schemas Zod. |

---

## 4. EMAIL (TICKET POR CORREO)

- **Situación actual:** El email con el ticket **no llega** en la prueba porque se usa un **email de prueba de MP** (`TESTUSER...@testuser.com`). Es el comportamiento esperado en sandbox.
- **Historial:** En un intento anterior, al intentar **cambiar/configurar el email** (envío real del ticket), el flujo se rompió y fue muy costoso recuperar el avance. Por eso se decidió trabajar en **módulos independientes**: este módulo (pago MP) queda cerrado; el envío de email real se aborda en **otro módulo**, sin modificar create-preference ni webhook.
- **Código existente:** `src/lib/email.ts` (Resend) y generación de PDF en webhook están implementados; requieren `RESEND_API_KEY` y dominio/from configurado. Cualquier cambio o activación de email se hace en un módulo aparte, sin tocar el flujo de pago aquí descrito.

---

## 5. VARIABLES DE ENTORNO (REFERENCIA)

- **Vercel (Preview):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` (TEST-...), `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL` = URL del Preview. Tras cambiar env, Redeploy.
- **Opcional para email:** `RESEND_API_KEY` (no necesario para compra de prueba exitosa).

---

## 6. DOCUMENTACIÓN RELACIONADA (SOLO LECTURA PARA ESTE MÓDULO)

- `INFORME_AUDITORIA_MP_CORREGIDO.md` — Auditoría y correcciones aplicadas (sandbox_init_point, CLP).
- `ANALISIS_INSTRUCCIONES_WEBHOOK_MP.md` — Análisis del webhook (firma, manifest, monto, etc.).
- `TRASPASO_CURSOR_SIGUIENTE_CHAT.md` — Contexto general y reglas de oro.
- `EJECUTAR_OPCION_A.md` — Pasos para probar en Preview.
- `GUIA_INSERCION_DATOS.md` — Datos y tablas en Supabase (incluye idempotency_keys).
- `.cursorrules` — Protocolo: analizar, proponer, ejecutar solo tras "Autorizado"/"Proceder".

---

## 7. PARA EL SIGUIENTE MÓDULO / NUEVO CHAT

- Abrir un **nuevo chat** en Cursor para el siguiente objetivo (p. ej. email real, enlace desde la home, reportes).
- En el primer mensaje del nuevo chat, pegar el contenido de **`INSTRUCCIONES_SIGUIENTE_MODULO.md`** (o el prompt que allí se indique) para que el asistente sepa: (1) este módulo MP está cerrado y no se modifica, (2) contexto del proyecto, (3) objetivo del nuevo módulo.
- No proponer ni ejecutar cambios en create-preference, webhook mercadopago, idempotency_keys ni flujo de /tickets/success/failure/pending salvo que se documente una excepción y autorización explícita.
