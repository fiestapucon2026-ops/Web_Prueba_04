# Solución definitiva — Tickets visibles tras pago (webhook + fallback polling)

**Proyecto:** web_oficial_festival  
**Objetivo:** Que el usuario vea e imprima sus entradas en Mis entradas tras un pago aprobado en Mercado Pago, aunque el webhook siga devolviendo 401 por firma.  
**Enfoque:** Mantener webhook + añadir **fallback por consulta activa a MP** en el flujo de by-reference, con una sola lógica de negocio (DRY) y sin duplicar tickets.

---

## 1. Decisión de arquitectura

- **Problema actual:** El webhook recibe las notificaciones de MP pero todas fallan con 401 "Firma inválida" (secret verificado 3 veces; causa atribuida a formato del manifest). La orden no pasa a `paid` y el usuario no ve tickets.
- **Solución elegida:** **Híbrido**
  1. **Webhook:** Se mantiene y se mejora el **debugging** (logs del manifest y de `data.id`). Si en el futuro se corrige la firma o MP alinea el formato, el webhook volverá a ser la vía principal.
  2. **Fallback en by-reference:** Cuando el usuario abre Mis entradas con token válido y las órdenes siguen `pending`, el backend **consulta a la API de MP** (con debounce/caché) el estado del pago. Si MP responde `approved`, el backend hace un **UPDATE atómico** a `paid`; **solo si se modificó al menos una fila**, llama a la **función compartida** que crea tickets y encola el PDF. Así el usuario ve sus tickets aunque el webhook nunca haya procesado la notificación.
- **Ventaja:** Desbloquea al usuario de inmediato. Si luego el webhook se corrige, no hay conflicto: quien llegue primero (webhook o fallback) hace el UPDATE; el otro verá 0 filas modificadas y no duplicará tickets gracias a la idempotencia.

---

## 2. Componentes de la solución

### 2.1 Función compartida: procesar orden aprobada (DRY)

- **Ubicación:** `src/lib/orders/process-approved-order.ts` (o equivalente).
- **Responsabilidad única:** Dado un `external_reference` (y opcionalmente el email del comprador), obtener de BD las órdenes con ese `external_reference` y **status = 'paid'**; para cada orden que aún no tenga filas en `tickets`, insertar las filas (una por unidad según `quantity`); insertar en `job_queue` el job `generate_ticket_pdf` con el payload ya usado hoy por el webhook.
- **No hace:** No llama a la API de MP. No hace UPDATE de `orders`. Solo lee órdenes ya marcadas como paid y crea tickets + job.
- **Idempotencia:** Antes de insertar tickets por `order_id`, comprobar si ya existen filas en `tickets` para ese `order_id`; si existen, no insertar de nuevo. Así webhook y fallback pueden llamar a esta función sin duplicar tickets.
- **Cliente Supabase:** Debe usar **admin** (Service Role) para leer `orders` y escribir en `tickets` y `job_queue`.
- **Llamantes:** (1) Webhook de Mercado Pago (después de su UPDATE a paid). (2) Flujo de fallback en by-reference (después del UPDATE atómico que modifique filas).

### 2.2 Webhook (sin cambiar lógica de firma; solo refactor y logs)

- **Refactor:** La parte que hoy crea tickets e inserta en `job_queue` se sustituye por una llamada a la función compartida `processApprovedOrder(external_reference, email)`.
- **Debugging (sin ejecutar aún):** Añadir logs **temporales** para diagnóstico de firma:
  - `x-signature` recibido completo (o solo “presente” + longitud si se prefiere no exponer el hash).
  - `data.id` extraído de la **URL (query)**.
  - `data.id` extraído del **body**.
  - El **string exacto del manifest** generado antes de hashear (ej. `id:123;request-id:abc;ts:123;`).
  - No loguear el secret ni el HMAC calculado en claro.
- **Comportamiento:** Si la firma pasa, UPDATE orders a paid como hoy, luego llamar a `processApprovedOrder`. Si la firma falla, seguir devolviendo 401.

### 2.3 by-reference: fallback con consulta a MP

- **Condición de entrada:** GET con token válido; se resuelve `external_reference` del token; se consultan órdenes con ese `external_reference`.
- **Si todas las órdenes están ya `paid`:** Comportamiento actual: devolver órdenes + tickets (y opcionalmente quitar `pending`). No llamar a MP.
- **Si hay órdenes `pending`:**
  1. **Debounce/caché:** Si en los últimos N segundos (ej. 10–15) ya se consultó a MP para este `external_reference` y el resultado fue `pending`, no volver a llamar a MP; devolver respuesta con `pending: true` y los datos actuales de BD. (Caché en memoria por `external_reference` con TTL; en serverless cada instancia tiene su propia memoria.)
  2. **Si no hay caché o ya expiró:** Obtener `payment_id` para ese `external_reference`. En el flujo actual, `payment_id` puede no estar en BD si el webhook nunca procesó; entonces hay que obtenerlo de MP (p. ej. búsqueda por `external_reference` con la API de MP, o si MP devuelve el id en la URL de success, habría que guardarlo en algún lado). **Nota:** La API de MP permite buscar pagos por `external_reference` (GET /v1/payments/search?external_reference=...). Usar ese endpoint con el Access Token.
  3. Si MP devuelve un pago con `status === 'approved'`:
     - **UPDATE atómico:** `UPDATE orders SET status = 'paid', mp_payment_id = :paymentId WHERE external_reference = :ref AND status = 'pending'`.
     - Comprobar **filas afectadas** (o que el resultado de Supabase indique que se actualizó al menos una fila).
     - Si **se modificó al menos 1 fila:** Llamar a `processApprovedOrder(external_reference, email)`. El email puede venir del primer registro de orders (user_email) o del pago de MP.
     - Si **0 filas modificadas:** El webhook (u otra petición) ya había actualizado; no crear tickets de nuevo. Solo volver a leer órdenes de BD y devolver la respuesta estándar (órdenes + tickets).
  4. Si MP devuelve `pending` o error: Guardar en caché “pending para este external_reference” con TTL 10–15 s; devolver `pending: true` en la respuesta.
- **Cliente Supabase:** Usar **admin** (requireSupabaseAdmin) para el UPDATE y para cualquier lectura/escritura que haga la función compartida o el propio by-reference en este flujo.
- **Rate limit:** El caché por `external_reference` reduce llamadas a MP; no hacer más de una llamada a MP por el mismo external_reference cada 10–15 s.

### 2.4 Obtención del payment_id cuando la orden está pending

- **Problema:** Si el webhook nunca procesó, `orders.mp_payment_id` puede ser NULL. Para consultar a MP necesitamos el `payment_id` o poder buscar por `external_reference`.
- **Solución:** Usar la API de MP **GET /v1/payments/search** con `external_reference` como filtro (si MP lo permite), o **GET /v1/payments/{id}** si en algún momento tenemos el id. Revisar documentación de MP Chile/Argentina para el endpoint exacto de búsqueda por external_reference. Si no existe búsqueda por external_reference, alternativas: (a) guardar en una tabla o en el sessionStorage del usuario el `collection_id`/`payment_id` que MP devuelve en la URL de success (y enviarlo al backend en una cabecera o en un primer request), o (b) que el frontend en Success lea `payment_id`/`collection_id` de la URL y lo envíe al backend al pedir el token o al llamar a by-reference (p. ej. by-reference podría aceptar un query opcional `payment_id=...` para el fallback). La opción (b) evita una tabla nueva y es razonable si la URL de success ya trae ese dato.

---

## 3. Flujo resumido (fallback)

1. Usuario paga en MP → redirigido a Success con `external_reference` y posiblemente `collection_id`/`payment_id` en la URL.
2. Success obtiene token (access-token) y redirige o enlaza a Mis entradas (token en sessionStorage o en query).
3. Mis entradas llama a GET by-reference con el token.
4. by-reference: token válido → lee órdenes por `external_reference`. Si todas paid → devuelve órdenes + tickets. Si hay pending → (con debounce) consulta a MP (por payment_id si está en BD o si el cliente lo envió; o por búsqueda por external_reference). Si MP dice approved → UPDATE atómico; si filas modificadas >= 1 → processApprovedOrder(); luego lee de nuevo y devuelve órdenes + tickets. Si MP dice pending → devuelve pending y cachea.
5. El usuario ve la lista de entradas con QR en la misma sesión o en la siguiente petición (polling).

---

## 4. Checklist de implementación (para quien ejecute)

- [ ] Crear `src/lib/orders/process-approved-order.ts`: leer órdenes paid por external_reference, crear tickets idempotente por order_id, insertar en job_queue. Usar requireSupabaseAdmin().
- [ ] Refactorizar webhook: después de UPDATE orders a paid, llamar a processApprovedOrder(); eliminar código duplicado de creación de tickets y job. Añadir logs de debugging (manifest, data.id query, data.id body).
- [ ] En by-reference: si hay órdenes pending, implementar debounce/caché por external_reference (TTL 10–15 s). Si hay que consultar a MP, obtener payment_id (desde BD, desde query opcional del request, o desde API de MP por external_reference según docs MP).
- [ ] En by-reference: llamada a API de MP (GET payment o search). Si status === 'approved', UPDATE atómico `WHERE external_reference = X AND status = 'pending'`. Si filas modificadas >= 1, llamar a processApprovedOrder(). Usar requireSupabaseAdmin() para UPDATE y para la función compartida.
- [ ] Asegurar idempotencia en processApprovedOrder (no insertar tickets si ya existen para ese order_id).
- [ ] (Opcional) Si la URL de success incluye collection_id/payment_id, documentar o implementar el envío de ese valor a by-reference (query o header) para usarlo en la consulta a MP y no depender de búsqueda por external_reference si MP no la ofrece.

---

## 5. Riesgos mitigados (según análisis previo)

| Riesgo | Mitigación |
|--------|------------|
| Duplicidad de tickets (webhook y fallback al mismo tiempo) | UPDATE atómico; crear tickets solo si filas modificadas >= 1; idempotencia en processApprovedOrder por order_id. |
| DRY | Una sola función processApprovedOrder; webhook y by-reference la reutilizan. |
| Permisos | by-reference y processApprovedOrder usan Supabase Admin (Service Role). |
| Rate limit a MP | Caché/debounce por external_reference, TTL 10–15 s. |
| Debugging de firma | Logs del manifest y data.id (query/body) en el webhook para análisis posterior. |

---

## 6. Resultado esperado

- **Caso A — Webhook sigue fallando (401):** El usuario entra a Mis entradas; by-reference ve pending, consulta a MP (con debounce), recibe approved, hace UPDATE atómico, llama a processApprovedOrder, y en la misma o en la siguiente petición devuelve órdenes + tickets. El usuario ve e imprime sus entradas.
- **Caso B — Webhook se corrige en el futuro:** El webhook hace UPDATE y processApprovedOrder; cuando el usuario entra a Mis entradas, las órdenes ya están paid y by-reference solo devuelve datos. El fallback no modifica filas (0 filas) y no duplica tickets.
- **Caso C — Ambos llegan casi a la vez:** Uno hace UPDATE (1 o más filas); el otro hace UPDATE y obtiene 0 filas. Solo el primero llama a processApprovedOrder; el segundo solo devuelve datos. Idempotencia en creación de tickets evita duplicados si hubiera race residual.

Esta es la **solución definitiva** acordada a partir de los análisis (firma inválida, DRY, carrera, permisos, rate limit y debugging). La implementación concreta debe seguir el checklist y las instrucciones de seguridad (no loguear secret, usar admin solo en servidor).
