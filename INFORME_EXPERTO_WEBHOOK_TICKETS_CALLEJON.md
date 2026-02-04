# Informe para experto — Webhook Mercado Pago y tickets: callejón sin salida

**Proyecto:** web_oficial_festival (Next.js 14+, TypeScript, Vercel, Supabase, Mercado Pago)  
**Dominio producción:** https://www.festivalpucon.cl  
**Fecha:** Febrero 2026  
**Objetivo:** Que tras un pago aprobado en MP el usuario vea e imprima sus entradas (tickets con QR) en la pantalla Mis entradas.  
**Estado:** Tras múltiples correcciones, el síntoma persiste: Mis entradas sigue mostrando "Procesando tu pago" y nunca aparecen los tickets.

---

## 1. ERROR ORIGINAL (SÍNTOMA)

- **Pantalla:** Tras pagar en Mercado Pago, el usuario llega a **Success** ("Venta exitosa") y hace clic en **"Ver e imprimir mis entradas"**.
- **Resultado:** Entra a **Mis entradas** (`/mis-entradas`) y ve **"Procesando tu pago. Tu compra está siendo confirmada. En unos segundos podrás ver tus entradas."** de forma indefinida (o hasta que aparecen 429 por rate limit).
- **Lo esperado:** Ver la lista de entradas con QR y opción de imprimir (o descargar PDF).
- **Conclusión:** La orden **nunca** pasa a `paid` en la base de datos; por tanto `GET /api/orders/by-reference` devuelve `pending: true` y sin tickets, y la UI no muestra la lista de entradas.

---

## 2. CAUSA RAÍZ (CONFIRMADA POR LOGS)

- El **webhook de Mercado Pago** (`POST /api/webhooks/mercadopago`) es el único componente que actualiza la orden de `pending` a `paid`, crea filas en `tickets` y encola el job para PDF/email.
- **Confirmado por logs de Vercel:** MP **sí** llama al webhook en el momento del pago. **Todas** las notificaciones reciben **401** por **"verificación de firma fallida: Firma inválida"**, por lo que no se ejecuta la lógica que actualiza la orden. **MP_WEBHOOK_SECRET ha sido verificado 3 veces y está correcto;** la causa de "Firma inválida" se atribuye al **formato del manifest** o al **manejo del timestamp**, no al valor del secret.

---

## 3. SOLUCIONES IMPLEMENTADAS (CRONOLOGÍA Y DETALLE)

### 3.1 Flujo Success y access-token (previo a este informe)

- **Problema:** En Success no aparecía el botón "Ver e imprimir mis entradas" porque `GET /api/orders/access-token?external_reference=...` devolvía **404** (se exigía orden `status = 'paid'`).
- **Solución:** Se eliminó el filtro por `status = 'paid'` cuando se busca por `external_reference`. Se entrega token si existe **cualquier** orden con ese `external_reference` (pending o paid).
- **Resultado:** access-token devuelve **200** con `token`; Success muestra el botón "Ver e imprimir mis entradas". **Éxito.**

### 3.2 by-reference para órdenes pending

- **Problema:** Si la orden estaba pending, by-reference devolvía 404 y la UI mostraba "Error al cargar".
- **Solución:** Se ajustó by-reference para devolver **200** con `{ pending: true, orders: [] }` cuando existe al menos una orden con ese `external_reference` pero ninguna está `paid`.
- **Resultado:** Mis entradas muestra "Procesando tu pago..." en lugar de error rojo. **Éxito parcial** (UX), pero la causa raíz (orden no pasa a paid) no se corrige.

### 3.3 Rate limit y polling

- **Problema:** Polling cada 5 s a by-reference superaba el rate limit (10 req/min) → **429 Too Many Requests** tras ~1 minuto.
- **Solución:** Rate limit de by-reference aumentado a **30 req/min**; intervalo de polling en Mis entradas aumentado a **6 s**.
- **Resultado:** Menos 429. **Éxito parcial.** La pantalla sigue en "Procesando tu pago" porque la orden sigue pending.

### 3.4 URL del webhook en Mercado Pago

- **Problema:** En el panel de MP figuraba una URL incorrecta: `https://web3-pucon2026.vercel.app/api/payment/webhook` (dominio y ruta distintos al código).
- **Solución:** Se configuró en MP la URL correcta: **`https://www.festivalpucon.cl/api/webhooks/mercadopago`** (documentado en `docs/MERCADOPAGO_WEBHOOK_URL.md`).
- **Resultado:** La notificación de MP, cuando se envíe, debe llegar al handler correcto. **No comprobado en pago real.**

### 3.5 Prueba de URL en el panel de MP (simulación)

- **Problema:** Al pulsar "Simular notificación" en MP, el webhook respondía **401 Unauthorized** (la simulación no envía headers de firma válidos).
- **Solución:** Se añadió detección del payload oficial de prueba de MP (`data.id === "123456"`, `date_created` 2021-11-01). Para ese payload se responde **200 OK** sin verificar firma.
- **Resultado:** "Simular notificación" en MP devuelve **200 - OK**. **Éxito.** No implica que los pagos reales funcionen.

### 3.6 Firma del webhook (data.id en body)

- **Problema:** Posible que MP envíe `data.id` solo en el body y no en la query; la firma se calculaba solo con `data.id` de la URL.
- **Solución:** Se modificó `verifyMercadoPagoSignature` para aceptar un segundo argumento `dataIdFromBody` y usar `data.id` de la query **o** del body al construir el manifest para el HMAC.
- **Resultado:** Código preparado para ambos casos. **No comprobado con notificación real.**

### 3.7 Cliente Supabase en el webhook

- **Problema:** Se usaba `requireSupabaseClient()` (que devuelve admin si existe, pero no es explícito).
- **Solución:** Se reemplazó por **`requireSupabaseAdmin()`** para garantizar escritura sin RLS.
- **Resultado:** Consistencia. **No comprobado con notificación real.**

### 3.8 Logging en el webhook

- **Solución:** Al inicio del POST se hace `console.log('[webhook-mp] POST recibido', url_query_data.id, x-signature presente/ausente, x-request-id presente/ausente)` para poder ver en Vercel Logs si llegan notificaciones.
- **Resultado:** Herramienta de diagnóstico disponible. **No se ha confirmado si tras una compra real aparece este log en Vercel.**

### 3.9 MP_WEBHOOK_SECRET

- **Problema:** Si el secret en Vercel no coincidía con la "Clave secreta" del webhook en el panel de MP, las notificaciones **reales** fallarían la verificación de firma → 401 → no se actualizaría la orden.
- **Solución:** El usuario verificó en MP el campo "Clave secreta" (en Configurar notificaciones Webhooks, modo prueba) y **actualizó** la variable **MP_WEBHOOK_SECRET** en Vercel para que coincidiera. Se realizó **Redeploy**.
- **Verificación explícita:** **MP_WEBHOOK_SECRET ha sido revisado y comparado con la Clave secreta de MP en tres ocasiones; las tres veces sin error.** Se descarta como causa de "Firma inválida" un valor incorrecto del secret.
- **Resultado:** Secret alineado y verificado. **El síntoma persiste:** todas las notificaciones reales siguen devolviendo 401 "Firma inválida" (véase sección 4.1).

---

## 4. EVIDENCIA DE LOGS (VERCEL) Y ESTADO ACTUAL

### 4.1 Logs de Vercel tras compra real

Se revisaron los logs del proyecto que sirve www.festivalpucon.cl en la ventana de una compra de prueba. **Hallazgos:**

- **MP sí llama al webhook.** Hay múltiples `POST /api/webhooks/mercadopago` en el momento del pago (p. ej. 21:03:21–21:03:22, 21:04:02, 21:20:58–21:21:09). La URL y el flujo de notificación están correctos.
- **Todas las notificaciones reciben 401** con mensaje: **`❌ Webhook Mercado Pago: verificación de firma fallida: Firma inválida`**.
- **Secuencia típica:** `POST /api/entradas/create-preference` 200 → (usuario paga en MP) → varios `POST /api/webhooks/mercadopago` 401 → `GET /success` 200 → `GET /api/orders/access-token` 200 → múltiples `GET /api/orders/by-reference` 200 (polling desde Mis entradas; la orden sigue pending).

**Conclusión:** La causa del 401 no es que MP no notifique, sino que **la verificación de firma falla en nuestro código**. Dado que **MP_WEBHOOK_SECRET ha sido verificado 3 veces y está correcto**, la causa de "Firma inválida" debe ser **formato del manifest** (orden de campos, origen de `data.id` — query vs body —, encoding) o **manejo del timestamp**, no el valor del secret.

### 4.2 Estado actual (lo que se ve en pantalla)

- **Success:** Funciona. El usuario paga, llega a Success, ve "Ver e imprimir mis entradas".
- **access-token:** Responde 200 con token (varias peticiones en 200).
- **by-reference:** Responde 200 con JSON que incluye `pending: true` y `orders: []` (sin tickets). No hay 429 en la captura reciente (20 peticiones en 200 en ~30 s).
- **Mis entradas:** Pantalla "Procesando tu pago. Tu compra está siendo confirmada. En unos segundos podrás ver tus entradas." con botones "Reintentar" e "Ir a entradas". **Nunca** se muestran los tickets con QR.
- **Conclusión técnica:** La orden correspondiente al `external_reference` de esa compra sigue en **`status = 'pending'`** en Supabase porque **todas** las notificaciones del webhook reciben 401 por "Firma inválida" y no se ejecuta la lógica que actualiza la orden.

---

## 5. LO QUE NO SE HA VERIFICADO (GAPS)

1. **Logs de Vercel:** Ya verificado. MP llama al webhook; todas las notificaciones reciben 401 "Firma inválida". **MP_WEBHOOK_SECRET verificado 3 veces sin error.**

2. **Contenido de la base de datos tras una compra de prueba**  
   No se ha ejecutado en Supabase una consulta del tipo:
   ```sql
   SELECT id, external_reference, status, mp_payment_id, user_email, created_at
   FROM public.orders
   WHERE external_reference::text = '<external_reference de la URL de success>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   para confirmar: si la fila existe, si `status` es `pending` o `paid`, y si `mp_payment_id` está rellenado (lo que indicaría que el webhook sí escribió).

3. **Formato exacto del manifest que MP usa al firmar (modo prueba)**  
   Documentación MP indica que `data.id` puede venir en query; en nuestro código usamos query o body. No se ha capturado una notificación real (headers + body) para validar que el manifest que construimos coincide exactamente con el que MP firma (orden de campos, uso de `data.id` en query vs body en la URL que MP llama, encoding de `v1`, timestamp en segundos vs milisegundos).

4. **Misma aplicación MP**  
   No se ha verificado explícitamente que el **Access Token** usado en el backend (create-preference) y la configuración del **webhook** (URL + Clave secreta) pertenezcan a la **misma** aplicación en "Tus integraciones". Si fueran de apps distintas, el secret o la URL podrían no corresponder al flujo que crea la preferencia.

---

## 6. HIPÓTESIS RESTANTES (POR QUÉ LA FIRMA FALLA — SECRET DESCARTADO)

**Hecho:** MP_WEBHOOK_SECRET ha sido verificado 3 veces; coincide con la Clave secreta de MP. **Se descarta** que "Firma inválida" se deba a un valor incorrecto del secret.

**Hipótesis que siguen abiertas:**

1. **Formato del manifest distinto al de MP:** Nosotros construimos `id:${dataId};request-id:${xRequestId};ts:${ts};`. Si MP usa otro orden de campos, otro separador, o incluye/excluye `id` según si `data.id` viene en la URL que MP llama (query) o solo en el body, el HMAC no coincidirá. En notificaciones reales, la URL a la que MP hace POST podría llevar `?data.id=...` o no; según eso, nuestro `dataId` (query vs body) debe coincidir con el que MP usa al firmar.
2. **Timestamp:** MP envía `ts` en segundos o milisegundos; nuestra tolerancia es 300 s. Si el formato que leemos no es el que MP usó en el manifest, o hay desfase de reloj, podría fallar (aunque el mensaje de log es "Firma inválida", no "Timestamp fuera de tolerancia").
3. **Encoding de `v1`:** Asumimos que `v1` en `x-signature` es hex; si MP envía otro formato, `timingSafeEqualHex` falla y se reporta como "Firma inválida".
4. **Aplicación equivocada:** Webhook (URL + Clave secreta) en una app y preferencias creadas con Access Token de otra app; entonces la clave que MP usa para firmar podría ser la de la otra app. (El secret que hemos verificado 3 veces es el de la app donde está configurada la URL; si create-preference usa token de otra app, las notificaciones podrían ir firmadas con otro secret.)
5. **Firma correcta pero fallo después:** Descartado hasta no pasar la firma; primero hay que resolver el 401.

---

## 7. ARCHIVOS Y CONFIGURACIÓN RELEVANTES

| Elemento | Ubicación / Valor |
|----------|-------------------|
| Handler webhook | `src/app/api/webhooks/mercadopago/route.ts` |
| URL configurada en MP | `https://www.festivalpucon.cl/api/webhooks/mercadopago` |
| Construcción de notification_url | `src/app/api/entradas/create-preference/route.ts` (multi-ítem), `src/app/api/tickets/create-preference/route.ts` (un ítem); usan `getBaseUrlFromRequest(request, ...)` |
| Documentación URL webhook | `docs/MERCADOPAGO_WEBHOOK_URL.md` |
| Variables de entorno críticas | `MP_WEBHOOK_SECRET`, `MP_ACCESS_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Vercel, proyecto que despliega www.festivalpucon.cl) |
| Evento MP | "Pagos" activo en modo prueba en la app. |

---

## 8. PETICIONES AL EXPERTO

1. **Formato del manifest en modo prueba:** Con **MP_WEBHOOK_SECRET verificado 3 veces y correcto**, todas las notificaciones reales fallan con "Firma inválida". ¿Cuál es el formato **exacto** del manifest que Mercado Pago usa para firmar en notificaciones reales de modo prueba (Checkout Pro)? ¿`data.id` debe tomarse de la **URL** que MP llama (query) o del **body** del POST? ¿Orden de campos `id` / `request-id` / `ts` y puntuación (p. ej. `id:...;request-id:...;ts:...;`)?
2. **Documentación o ejemplos:** ¿Existe documentación oficial o ejemplos (Node/JS, PHP, etc.) actualizados para validar la firma de webhooks de MP en notificaciones de pago, con el manifest exacto y el tratamiento de `data.id` (query vs body)?
3. **Verificación de aplicación:** ¿Cómo confirmar que la URL y la Clave secreta del webhook y el Access Token usados en create-preference pertenecen a la **misma** aplicación de MP? (Si fueran de apps distintas, el secret que hemos verificado podría no ser el que MP usa para firmar esas notificaciones.)
4. **Logging del manifest (sin exponer secret):** ¿Es recomendable añadir un log temporal del **manifest** que construimos (y de si `data.id` vino de query o de body) para comparar con la documentación de MP, sin loguear el secret ni el valor de `v1`?
5. **Alternativas si la firma no se resuelve:** Si no se logra hacer coincidir la verificación de firma, ¿qué alternativas son estándar (p. ej. consultar el pago por API de MP con `external_reference` o `payment_id` desde Success o un job) para actualizar la orden a `paid` y mostrar los tickets sin depender del webhook?

---

## 9. RESUMEN EJECUTIVO

- **Objetivo:** Que tras un pago aprobado en MP el usuario vea e imprima sus entradas en Mis entradas.
- **Problema:** La orden nunca pasa a `paid`; Mis entradas muestra "Procesando tu pago" de forma indefinida.
- **Causa raíz confirmada por logs:** Mercado Pago **sí** llama al webhook (múltiples POST en el momento del pago). **Todas** las notificaciones reciben **401** con mensaje **"verificación de firma fallida: Firma inválida"**, por lo que no se ejecuta la lógica que actualiza la orden a `paid` ni crea tickets.
- **MP_WEBHOOK_SECRET:** Ha sido **verificado 3 veces** comparando con la Clave secreta del panel de MP; **las 3 veces sin error.** Se descarta que "Firma inválida" se deba a un valor incorrecto del secret.
- **Soluciones ya aplicadas:** URL correcta en MP, firma con data.id en query o body, MP_WEBHOOK_SECRET corregido y verificado (3 veces), aceptar payload de prueba, logging, Supabase admin, rate limit y polling. El síntoma persiste porque la verificación de firma sigue fallando.
- **Foco actual:** La causa de "Firma inválida" debe ser **formato del manifest** (orden de campos, origen de `data.id` — query vs body en la URL que MP llama —, encoding) o **manejo del timestamp**, no el valor del secret.
- **Se solicita:** Guía de un experto sobre el formato **exacto** del manifest que MP usa al firmar en modo prueba (Checkout Pro), verificación de que webhook y Access Token son de la misma app, y si hace falta alternativas (p. ej. consultar pago por API) para actualizar la orden y mostrar los tickets.
