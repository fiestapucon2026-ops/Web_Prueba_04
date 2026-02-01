# Análisis profundo: integración E2E y por qué MP no muestra retorno

**Contexto:** En otra versión del mismo desarrollo, MP sí mostraba botón y cuenta regresiva de 10 s que llevaba a "Venta exitosa" (imprimir tickets con QR / enviar email). Ahora no. Los puntos 7 y 8 ya se probaron; falta que todo funcione integrado. Dominio actual en Vercel: **https://web-prueba-04.vercel.app** (Production desde `main`).

**Solo análisis; sin ejecución de código.**

---

## Autoevaluación de las respuestas anteriores: **58/100**

- Se acertó en: no tocar create-preference sin respaldo, quitar barra final de la URL, que la URL de éxito debe ser correcta.
- Se falló o se dio poca ponderación a: causa real del comportamiento de MP, dominio correcto a usar, flujo 100 % en un solo deployment, y verificación sistemática de todas las variables.

---

## Errores y omisiones que impiden llegar a 100

### 1. Atribución falsa al comportamiento de MP (sandbox)

**Error:** Se dijo que "a veces MP no muestra ese enlace en modo prueba".

**Realidad:** En otra versión del mismo proyecto sí se mostraba botón y cuenta regresiva. Por tanto la causa no es "modo prueba de MP", sino algo de **nuestra** integración o del entorno (URL que enviamos, deployment que responde, env).

**Solución:** Dejar de atribuir a MP/sandbox. Asumir que si MP no muestra retorno es porque: (a) la URL de éxito que enviamos es inválida o inalcanzable (404, doble barra, dominio equivocado), o (b) el valor de `NEXT_PUBLIC_BASE_URL` en el entorno que crea la preferencia no es el dominio donde realmente está la app (web-prueba-04.vercel.app). Verificar siempre qué `back_urls.success` se está enviando y que esa URL responda 200.

---

### 2. Poca ponderación a la “alcancibilidad” de la URL de éxito

**Omisión:** No se enfatizó que MP puede **validar** o **usar** la URL de éxito (p. ej. al mostrar el enlace o al hacer redirect). Si `back_urls.success` devuelve 404 o no es accesible, MP puede no mostrar botón ni countdown.

**Solución:** Tratar la alcancibilidad como requisito explícito:  
`back_urls.success` = `https://web-prueba-04.vercel.app/success` (o el dominio que corresponda) debe abrir en navegador y devolver 200 (página de éxito, no 404). Comprobar eso **antes** de dar por bueno el flujo. Si en algún momento se usó un dominio que da 404 (p. ej. el antiguo git-feature-me), esa preferencia tendría una URL "rota" y MP no mostraría retorno.

---

### 3. Confusión y dispersión de dominios

**Omisión:** Se habló de varias URLs (git-feature-me, web-prueba-04, localhost) sin fijar **una sola** como la de referencia para el flujo integrado.

**Realidad:** En Vercel Production aparecen **web-prueba-04.vercel.app** y **www.festivalpucon.cl**. La URL que debe usarse para pruebas integradas es la que **realmente sirve** `/entradas` y `/success`: según tu captura, esa es **https://web-prueba-04.vercel.app** (o la que muestre "Visit" en el deployment de Production).

**Solución:** Definir un único dominio base para el E2E integrado:  
**BASE = https://web-prueba-04.vercel.app** (sin barra final).  
Toda la cadena debe usar ese BASE: abrir BASE/entradas, crear preferencia con ese BASE en `back_urls`, redirigir a BASE/success, y luego BASE/mis-entradas. En Vercel, `NEXT_PUBLIC_BASE_URL` debe ser exactamente ese valor (y solo ese) para el entorno que sirve ese dominio.

---

### 4. Dónde y cómo se fija `NEXT_PUBLIC_BASE_URL`

**Omisión:** No se dejó claro que la preferencia se crea en el **servidor que atiende la petición** (el que ejecuta create-preference). Si el usuario entra en **localhost/entradas**, la preferencia la crea el servidor **local** y usa `NEXT_PUBLIC_BASE_URL` de `.env.local`. Si entra en **web-prueba-04.vercel.app/entradas**, la crea **Vercel** y usa la variable de **Vercel** (Production/Preview).

**Solución:** Para un flujo 100 % integrado en Vercel:  
- El usuario debe abrir **https://web-prueba-04.vercel.app/entradas** (no localhost).  
- En Vercel → proyecto → Settings → Environment Variables, para el entorno que corresponde a ese deployment (p. ej. Production), debe estar:  
  `NEXT_PUBLIC_BASE_URL = https://web-prueba-04.vercel.app`  
  (sin barra final, sin espacios).  
- No tener en Production un valor distinto (p. ej. el antiguo git-feature-me).  
- Tras cambiar la variable, hacer **Redeploy** para que la nueva preferencia se cree ya con esa base.

---

### 5. Rama y deployment que sirven `/entradas` y `/success`

**Omisión:** Se habló de 404 en una URL (git-feature-me) pero no se ató a: "el deployment que responde en **web-prueba-04.vercel.app** es el de **main**; si `/entradas` o `/success` no están en **main**, ese dominio dará 404".

**Solución:** Confirmar que la rama que despliega en **web-prueba-04.vercel.app** (en tu caso, **main**) contiene:  
- `src/app/entradas/page.tsx`  
- `src/app/success/page.tsx`  
Si no, hacer merge de la rama que sí los tiene a **main** y volver a desplegar. El flujo integrado solo puede funcionar si el mismo deployment que tiene `/entradas` también tiene `/success` y responde 200 en ambas.

---

### 6. Normalización de `baseUrl` en tickets/create-preference

**Omisión:** En **entradas** create-preference (rama multi-ítem) sí se hace `.trim()` y `.replace(/\/$/, '')` sobre `baseUrl`. En **tickets** create-preference **no**; se usa `baseUrl` tal cual. Si en Vercel queda una barra final o espacios, `back_urls.success` podría ser `https://...vercel.app//success` o con espacios, y MP podría rechazarla o no mostrar el retorno.

**Solución:** (Con respaldo previo del archivo.) En **tickets** create-preference, después de asignar `baseUrl`, normalizar una sola vez para uso en MP, por ejemplo:  
`const baseUrlClean = (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl').trim().replace(/\/$/, '');`  
y usar `baseUrlClean` en `back_urls` y `notification_url`. Así, aunque la variable tenga barra final o espacios, la URL enviada a MP será válida. Es el único cambio mínimo recomendado en un archivo puente; el resto del archivo se deja igual.

---

### 7. Llamada interna entradas → tickets cuando el usuario está en Vercel

**Omisión:** Cuando el usuario está en **web-prueba-04.vercel.app/entradas**, el POST a create-preference lo atiende Vercel. Entradas hace `fetch(baseUrl + '/api/tickets/create-preference')`. Si en Vercel `NEXT_PUBLIC_BASE_URL` no está definida o está mal, entradas usa el fallback: en entradas (rama 1 ítem) el fallback es `'http://localhost:3000'`. Eso haría que Vercel intente llamar a **localhost**, que desde los servidores de Vercel no existe → fallo o comportamiento errático.

**Solución:** En el entorno de Vercel que sirve **web-prueba-04.vercel.app**, **NEXT_PUBLIC_BASE_URL** debe estar **siempre** definida y ser **https://web-prueba-04.vercel.app**. Así la llamada interna va al mismo deployment y la preferencia se crea con el mismo dominio en `back_urls`. Incluir esta comprobación en el checklist previo al E2E.

---

### 8. Webhook y cierre del flujo (token y mis-entradas)

**Omisión:** No se integró en un solo checklist que, tras el pago, MP llame al webhook, las órdenes pasen a `paid`, se creen tickets y se genere el token. Si el webhook no se ejecuta o falla, `/success` no obtendrá token y el usuario no llegará bien a mis-entradas.

**Solución:** Asegurar que:  
- `notification_url` enviada a MP sea `https://web-prueba-04.vercel.app/api/webhooks/mercadopago` (mismo baseUrl).  
- En Vercel estén configuradas para ese entorno: `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SIGNING_SECRET`, `RESEND_API_KEY`, etc.  
- En el dashboard de MP, la URL del webhook para ese aplicativo apunte a esa misma URL.  
Incluir en el checklist: "Tras aprobar el pago, en Supabase las órdenes de ese `external_reference` pasan a `paid` y existen filas en `tickets`". Si eso no ocurre, el fallo está en webhook/env, no en create-preference ni en success.

---

### 9. Flujo de prueba único y sin ambigüedad

**Omisión:** No se dio un único procedimiento paso a paso que garantice que todo ocurre en el mismo dominio y con la misma variable.

**Solución:** Documentar un **flujo integrado estándar**:

1. En Vercel: `NEXT_PUBLIC_BASE_URL` = `https://web-prueba-04.vercel.app` (Production). Redeploy.
2. Abrir **https://web-prueba-04.vercel.app/entradas** (no localhost).
3. Completar formulario y Continuar → se crea la preferencia en ese mismo deployment con ese baseUrl.
4. Pagar en MP (sandbox).
5. Comprobar: MP redirige o muestra enlace a **https://web-prueba-04.vercel.app/success?external_reference=...&status=approved**.
6. En /success: polling del token y redirección a **https://web-prueba-04.vercel.app/mis-entradas?token=...**.
7. Webhook: órdenes `paid`, tickets creados, email enviado.

Cualquier desvío (abrir localhost, otro dominio, otra variable) invalida la prueba integrada.

---

### 10. Posible validación de MP sobre `back_urls`

**Omisión:** No se consideró explícitamente que MP podría comprobar (p. ej. HEAD/GET) que la URL de éxito sea válida antes de mostrar el enlace o la cuenta regresiva.

**Solución:** Asumir que MP puede depender de que la URL sea válida y responda bien. Por tanto: antes de dar por cerrado el punto 6, comprobar que **https://web-prueba-04.vercel.app/success** (sin query) abre y devuelve 200 con la página de "Venta exitosa". Si esa URL da 404 o 500, corregir deployment/rama antes de seguir probando la integración con MP.

---

## Resumen: qué debe cumplirse para acercarse a 100

| # | Requisito | Acción concreta |
|---|-----------|-----------------|
| 1 | No culpar a MP | Asumir que el fallo está en nuestra URL/env/deployment hasta demostrar lo contrario. |
| 2 | URL de éxito alcanzable | Verificar que BASE/success devuelve 200. |
| 3 | Un solo dominio para E2E | Usar solo **https://web-prueba-04.vercel.app** como BASE. |
| 4 | Variable en el servidor correcto | En Vercel (entorno que sirve ese dominio): NEXT_PUBLIC_BASE_URL = BASE, sin barra. Redeploy. |
| 5 | Rutas en la rama desplegada | main (o la rama que sirve web-prueba-04) debe tener /entradas y /success. |
| 6 | baseUrl sin barra/espacios en tickets | Normalizar en tickets/create-preference (con respaldo) para evitar //success. |
| 7 | Llamada entradas→tickets en Vercel | NEXT_PUBLIC_BASE_URL definida en Vercel para que el fetch no vaya a localhost. |
| 8 | Webhook correcto | notification_url = BASE/api/webhooks/mercadopago; env y URL de webhook en MP alineados. |
| 9 | Un solo procedimiento E2E | Siempre abrir BASE/entradas, pagar, comprobar redirección a BASE/success y luego BASE/mis-entradas. |
| 10 | MP y validez de URL | Tratar back_urls.success como URL que debe ser válida y respondida por nuestro servidor. |

Con esto se corrigen los errores y omisiones que impedían llegar a 100 y se deja un criterio claro para que el retorno de MP (botón y/o cuenta regresiva) y el flujo integrado funcionen de forma estable.
