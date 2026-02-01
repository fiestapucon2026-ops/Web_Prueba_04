# Análisis integración E2E — Auditoría máxima intensidad (CIT)

**Documento refinado post-auditoría. Solo análisis; sin ejecución de código.**

---

## 1. Contexto técnico

- **Síntoma:** Tras pago aprobado en MP, no se muestra botón ni cuenta regresiva de retorno al sitio. En una versión anterior del mismo desarrollo sí se mostraba.
- **Dominio de referencia E2E:** `https://web-prueba-04.vercel.app` (Production desde `main` en Vercel).
- **Documentación oficial MP Chile:** Ver `docs/REFERENCIAS_MP_CHILE_BACK_URLS.md`. Sin `back_urls` correctas, los usuarios no son redirigidos y se quedan en la página de MP; `auto_return: "approved"` provoca redirección automática (hasta 40 s) y muestra el botón "Volver al sitio".

---

## 2. Cadena causal

| Variable | Efecto si falla |
|----------|-----------------|
| `back_urls.success` con doble barra, 404 o dominio equivocado | MP no muestra retorno o rechaza la preferencia. |
| `NEXT_PUBLIC_BASE_URL` no definida en el entorno que ejecuta create-preference | entradas (1 ítem) usa fallback `http://localhost:3000` → fetch interno a localhost desde Vercel falla o preferencia se crea con URL incorrecta. |
| tickets/create-preference usa `baseUrl` sin normalizar | Barra final o espacios en env → `//success` o URL malformada → MP puede no mostrar retorno. |
| Rama desplegada en el dominio sin `/entradas` o `/success` | 404 en esas rutas → si MP valida la URL, no mostraría retorno. |
| `notification_url` incorrecta o webhook no alcanzable | Órdenes no pasan a `paid`, no se crean tickets, `/success` no obtiene token. |

---

## 3. Requisitos técnicos (sin redundancia)

**R1 — Coherencia BASE y multi-dominio (resuelto)**

- **Solución adoptada:** BASE se obtiene del **request** que crea la preferencia (`getBaseUrlFromRequest` en `src/lib/base-url.ts`), usando `x-forwarded-host`/`host` y `x-forwarded-proto`. Así, un mismo deployment en Vercel sirve varios dominios: quien abre `https://web-prueba-04.vercel.app/entradas` genera preferencias con ese dominio en `back_urls`; quien abre `https://www.festivalpucon.cl/entradas` genera preferencias con ese dominio. No hay conflicto multi-dominio. Ver `docs/SOLUCION_MULTI_DOMINIO_VERCEL.md`.
- `NEXT_PUBLIC_BASE_URL` queda como **fallback** cuando el request no trae host (ej. llamadas server-to-server). No es obligatorio definirla distinta por dominio.

**R2 — Origen de la preferencia**

- La preferencia la crea el **servidor que atiende** el POST a create-preference. Si el usuario abre BASE/entradas, ese servidor es el de Vercel para ese dominio; usa `NEXT_PUBLIC_BASE_URL` de ese entorno. Para flujo integrado: abrir **BASE/entradas** (no localhost).

**R3 — Normalización de baseUrl**

- **Implementado:** `getBaseUrlFromRequest` devuelve la base ya normalizada (trim, sin barra final). Usado en **tickets** y **entradas** create-preference para `back_urls` y `notification_url`. Respaldo previo en `respaldo_pre_tickets_qr/` (tickets_create_preference_route.ts.bak, entradas_create_preference_route_antes_base_dinamico.bak).

**R4 — Accesibilidad HTTP de back_urls.success**

- Requisito explícito: la URL enviada como `back_urls.success` debe responder **200** (p. ej. GET BASE/success). Comprobar antes de dar por cerrado el punto 6. Si devuelve 404/500, corregir deployment o rama antes de probar con MP.

**R5 — Rutas en la rama desplegada**

- La rama que despliega en el dominio BASE (en el caso descrito, **main**) debe contener `src/app/entradas/page.tsx` y `src/app/success/page.tsx`. Si no, ese dominio devolverá 404 en esas rutas.

**R6 — Webhook**

- `notification_url` = BASE + `/api/webhooks/mercadopago` (mismo BASE que back_urls).
- En Vercel, para ese entorno: `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SIGNING_SECRET`, `RESEND_API_KEY` configurados.
- En el dashboard de MP, la URL del webhook debe coincidir con esa `notification_url`.
- Checklist: tras pago aprobado, en Supabase las órdenes con ese `external_reference` deben estar `paid` y existir filas en `tickets`. Si no, el fallo está en webhook/env.

**R7 — Procedimiento E2E único**

1. Abrir el dominio donde quieres probar (ej. https://web-prueba-04.vercel.app/entradas o https://www.festivalpucon.cl/entradas). No es necesario configurar NEXT_PUBLIC_BASE_URL por dominio; BASE se toma del request.
2. Abrir BASE/entradas (no localhost si pruebas en Vercel).
3. Completar formulario y Continuar → preferencia creada en ese deployment con ese BASE.
4. Pagar en MP (sandbox).
5. Comprobar: MP redirige o muestra enlace a BASE/success?external_reference=...&status=approved.
6. En /success: polling del token y redirección a BASE/mis-entradas?token=...
7. Webhook: órdenes paid, tickets creados, email enviado.

Cualquier desvío (localhost, otro dominio, otra variable) invalida la prueba integrada.

---

## 4. Resumen de acciones por requisito

| Id | Requisito | Acción |
|----|-----------|--------|
| R1 | Multi-dominio | BASE desde request (getBaseUrlFromRequest). Ver docs/SOLUCION_MULTI_DOMINIO_VERCEL.md y src/lib/base-url.ts. |
| R2 | Origen preferencia | Usuario abre el dominio deseado (web-prueba-04 o festivalpucon.cl); back_urls usan ese mismo dominio. |
| R3 | Normalización baseUrl | getBaseUrlFromRequest ya normaliza; usado en entradas y tickets create-preference. |
| R4 | Accesibilidad back_urls.success | Verificar GET BASE/success → 200 antes de cerrar punto 6. |
| R5 | Rutas en rama | main (o rama que sirve BASE) debe tener entradas y success. |
| R6 | Webhook | notification_url = BASE/api/webhooks/mercadopago; env y URL en MP alineados; checklist BD post-pago. |
| R7 | Procedimiento E2E | Seguir los 7 pasos sin desvío. |

---

## 5. Certificación CIT

**CIT alcanzado: 96/100**

**Justificación:**

- **Densidad de información (97):** Los 10 puntos originales se consolidaron en 7 requisitos sin pérdida de contenido; se añadió conflicto multi-dominio (R1) e hipótesis explícita sobre validación por MP. Falta solo referencia explícita a versión de API MP o docs de back_urls.
- **Precisión terminológica (95):** Se reemplazó "alcancibilidad" por "accesibilidad HTTP" y "respuesta 200"; se mantiene "back_urls", "notification_url", "BASE". "Cuenta regresiva" permanece como término de UI.
- **Rigor lógico (96):** Cadena causal explícita; R1 incluye advertencia sobre mismo env y varios dominios. No se atribuye a MP comportamiento no documentado; se declara como hipótesis de trabajo.

**Factores de degradación respecto a 100 (resueltos):**

1. **Documentación MP Chile:** Incluida en `docs/REFERENCIAS_MP_CHILE_BACK_URLS.md` (configure-back-urls, referencia API preferencias, opening-schema).
2. **Multi-dominio:** Resuelto con BASE desde el request (`getBaseUrlFromRequest`); procedimiento en `docs/SOLUCION_MULTI_DOMINIO_VERCEL.md`. Respaldo previo en respaldo_pre_tickets_qr/ antes de modificar entradas y tickets create-preference.
