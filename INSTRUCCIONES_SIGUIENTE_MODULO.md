# Instrucciones para el siguiente módulo / nuevo chat

**Uso:** Copia todo el contenido desde "--- INICIO PROMPT ---" hasta "--- FIN PROMPT ---" y pégalo como **primer mensaje** en un nuevo chat de Cursor. Así el asistente tendrá contexto y no tocará el módulo MP cerrado.

---

--- INICIO PROMPT ---

## CONTEXTO DE PROYECTO

Proyecto **web_oficial_festival** (venta de tickets Festival Pucón 2026). Stack: Next.js 14+, TypeScript estricto, Tailwind, Vercel, Mercado Pago, Supabase. Rama: **feature/mercado-pago-payment**. Repo: fiestapucon2026-ops/Web_Prueba_04. Workspace típico: `/home/lvc/web_oficial_festival`.

## MÓDULO MERCADO PAGO — CERRADO (NO MODIFICAR)

El **módulo de pago con Mercado Pago está cerrado**. La primera compra de prueba exitosa ya se completó (pago aprobado, orden `paid`, redirección a `/success`).

**Regla obligatoria:** No modificar este módulo. En concreto, no tocar:
- `src/app/api/tickets/create-preference/route.ts`
- `src/app/api/webhooks/mercadopago/route.ts`
- Tabla `public.idempotency_keys` y migración `supabase/migrations/idempotency_fix.sql`
- Flujo de `/tickets` (compra), `/success`, `/failure`, `/pending`
- **Pantalla de inicio — INTOCABLE:** `src/app/page.tsx` y `src/components/pantalla-inicio/PantallaInicio.tsx` **no se modifican**. La página de inicio está **actualmente en uso en Internet** (producción); cualquier cambio afecta al sitio en vivo. Solo se podrá plantear modificaciones en otro proceso, con decisión explícita.

Todo lo anterior está documentado en **`MODULO_MP_CERRADO.md`**. Consultar ese archivo para estado exacto, archivos involucrados y motivo del cierre (evitar repetir el error de romper el flujo al tocar email u otro cambio en el mismo módulo).

**Email:** El ticket por correo no llega en prueba porque se usa email de prueba de MP; es esperado. En el pasado, cambiar/configurar el email rompió el flujo. El envío de email real se aborda en **módulos independientes**, sin modificar el flujo de pago actual.

## PROTOCOLOS

- Según `.cursorrules`: analizar, proponer, ejecutar código solo tras autorización explícita ("Autorizado"/"Proceder").
- Variables en Vercel aplican a **nuevos** deployments; tras cambiar env, Redeploy.

## OBJETIVO DE ESTE CHAT (NUEVO MÓDULO)

**[Definir aquí el objetivo del nuevo módulo, por ejemplo:]**
- Configurar envío real del ticket por email (Resend) sin modificar create-preference ni webhook, **o**
- Añadir enlace "Comprar entradas" desde la página principal (solo el enlace, sin cambiar flujo de pago), **o**
- Otro objetivo: ___

Trabajar en módulos independientes: los cambios de este chat no deben alterar el flujo de pago ya validado (create-preference, webhook, idempotency, /tickets, success/failure/pending).

--- FIN PROMPT ---
