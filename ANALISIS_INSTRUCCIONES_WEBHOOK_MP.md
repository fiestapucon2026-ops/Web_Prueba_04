# Análisis de instrucciones: Webhook Handler Seguro (Mercado Pago)

**Objetivo:** Evaluar las instrucciones recibidas frente al código actual y la documentación oficial de MP. No ejecutar; solo análisis técnico. Comprensión >98%; no asumir sin información suficiente.

---

## 1. Fuentes cotejadas

- **Código actual:** `src/app/api/webhooks/mercadopago/route.ts` (346 líneas).
- **Lib:** `src/lib/supabase.ts`, `src/lib/pdf.tsx`, `src/lib/email.ts`, `src/lib/types.ts`.
- **Documentación MP:** [Webhooks - Validate notification origin](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks) (fetch 2025-01-29).

---

## 2. Requisito 1 — Validación de firma (HMAC SHA-256)

### 2.1 Instrucción

- No procesar NADA si la firma es inválida.
- Extraer `x-signature` (formato `ts=timestamp,v1=hash`), `x-request-id`, `data.id` del body.
- Reconstruir manifest: `id:${dataID};request-id:${xRequestId};ts:${ts};`
- HMAC con `MP_WEBHOOK_SECRET`; comparar con `v1`; si falla, retornar 401.

### 2.2 Código actual

- Firma obligatoria: no se procesa body si falta `MP_WEBHOOK_SECRET` o si la verificación falla (503/401).
- `x-signature` y `x-request-id` se extraen de headers.
- **Origen de `data.id` para el manifest:** en el código se usa `url.searchParams.get('data.id')` (query string de `request.url`), no el body.

### 2.3 Documentación oficial MP

- Template del manifest: `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
- Texto literal: *"Parameters with the _url suffix come from **query params**. Example: [data.id_url] will be replaced by the corresponding event ID value (data.id) ... **This query param can be found in the received notification.**"*
- Ejemplos PHP/Node/Python/Go usan **query params** para `data.id` (p. ej. `$queryParams['data.id']`, `urlParams.get('data.id')`).

### 2.4 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| No procesar si firma inválida | Sí | Ya implementado. |
| Extraer x-signature, x-request-id | Sí | Ya implementado. |
| **Extraer data.id del body para el manifest** | **No** | **Error en la instrucción.** Para el manifest, MP documenta que `data.id` viene en **query params** de la URL de la notificación, no en el body. El código actual (query) es correcto. |
| Orden del manifest id; request-id; ts | Sí | Coincide con MP y con nuestro código. |
| HMAC SHA-256, comparar v1, 401 si falla | Sí | Ya implementado (incluye tolerancia de timestamp y comparación timing-safe). |

**Recomendación:** No cambiar el origen de `data.id` para la firma: debe seguir siendo **query param** (`request.url`), no body. El `paymentId` para llamar a `payment.get()` sí se toma del body (`body.data?.id || body.id`); eso está bien y no debe usarse en el manifest en lugar del query.

---

## 3. Requisito 2 — Fuente de verdad (payment.get)

### 3.1 Instrucción

- Ignorar estado del JSON del request.
- Usar `mercadopago.payment.get({ id: dataID })` para estado real.
- Solo continuar si `payment.status === 'approved'` y `payment.status_detail === 'accredited'`.

### 3.2 Código actual

- Se ignora el estado del body; se usa `paymentClient.get({ id: paymentIdNum })` y se actúa según `payment.status` (approved, rejected, pending, cancelled).
- **No** se comprueba `payment.status_detail === 'accredited'`.

### 3.3 Documentación MP

- Get payment: se obtiene el recurso completo; `status` y `status_detail` son campos del recurso.
- No se ha cotejado en este análisis si, para Checkout Pro, todo pago considerado "approved" tiene siempre `status_detail === 'accredited'` o si existen otros valores válidos (p. ej. otros flujos o países).

### 3.4 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| Ignorar body para estado; usar payment.get | Sí | Ya implementado. |
| Condición `status === 'approved'` | Sí | Ya implementado (branch `case 'approved'`). |
| Condición `status_detail === 'accredited'` | Condicional | La instrucción la exige. Riesgo: si MP devuelve `approved` con otro `status_detail` válido, rechazaríamos ese pago. **Recomendación:** Verificar en la referencia de Payments de MP (Get payment) los valores posibles de `status_detail` para pagos aprobados; si solo `accredited` es válido para nuestro flujo, añadir la condición; si no, documentar y opcionalmente loguear sin bloquear. |

---

## 4. Requisito 3 — Lógica de negocio y anti-fraude

### 4.1 Instrucción

- Buscar orden por `payment.external_reference` (nuestro `order.external_reference`).
- **Check de monto:** Verificar que `payment.transaction_amount` sea IGUAL a `order.amount`; si difieren, lanzar error (posible manipulación).
- Idempotencia: si `order.status` ya es `'paid'`, retornar 200 y detener (no enviar correos duplicados).

### 4.2 Código actual

- Búsqueda por `external_reference` y comprobación de idempotencia por `mp_payment_id` y por `order.status === 'paid'` antes de actualizar y antes de enviar PDF/email.
- **No** se compara `payment.transaction_amount` con `order.amount`.

### 4.3 Tipos y API MP

- `order.amount` en nuestro schema es `number` (Supabase).
- En Get payment, `transaction_amount` es típicamente `number` (p. ej. 100.00). Para CLP suele ser entero.
- Comparación directa con `===` entre dos `number` puede fallar por punto flotante; para CLP (enteros) o se redondea o se compara con tolerancia.

### 4.4 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| Buscar orden por external_reference | Sí | Ya implementado. |
| Check monto: transaction_amount === order.amount | Sí | **No implementado.** Añadir comprobación tras obtener la orden y antes de marcar como paid. Si difieren: log, retornar 200 (o 400) y no actualizar orden (evitar marcar como paid). Comparación: usar tolerancia numérica o enteros (p. ej. Math.round para CLP). |
| Idempotencia: si ya paid, 200 y detener | Sí | Ya implementado (por mp_payment_id y por status paid; no se envía PDF/email duplicado). |

---

## 5. Requisito 4 — Transacción de cierre (atomicidad)

### 5.1 Instrucción

- Actualizar orden: `status: 'paid'`, `mp_payment_id: payment.id`.
- Usar cliente "supabaseAdmin" (Service Role) para permisos de escritura.

### 5.2 Código actual

- Update con `.eq('id', order.id).eq('status', 'pending')` (transición atómica pending → paid) y se guarda `mp_payment_id`.
- Se usa `requireSupabaseClient()`, que devuelve `supabaseAdmin ?? supabasePublic`. En el entorno del webhook (Vercel) normalmente está configurado `SUPABASE_SERVICE_ROLE_KEY`, por lo que en la práctica se usa admin.

### 5.3 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| Actualizar status y mp_payment_id atómicamente | Sí | Ya implementado. |
| Usar cliente Service Role | Sí | Funcionalmente ya se cumple. Para ser explícitos y garantizar RLS bypass, se puede cambiar en este route a `requireSupabaseAdmin()` en lugar de `requireSupabaseClient()`. |

---

## 6. Requisito 5 — Entrega de producto (PDF + Email)

### 6.1 Instrucción

- Generar PDF en memoria (Buffer) con `renderToBuffer` de `@react-pdf/renderer` y componente `TicketEmailTemplate`.
- Enviar con `resend.emails.send`: `to: order.user_email`, `attachments: [{ filename: 'Ticket.pdf', content: pdfBuffer }]`.

### 6.2 Código actual

- PDF: `generateTicketPDF(order)` en `src/lib/pdf.tsx` usa `pdf(<TicketPDF order={order} />)` (API de `@react-pdf/renderer`), luego `.toBlob()` → `arrayBuffer` → `Buffer`. No se usa `renderToBuffer` (puede ser otra API o versión); el resultado es Buffer en memoria.
- Email: `sendTicketEmail(order, pdfBuffer)` usa `resend.emails.send` con `to: order.user_email` y `attachments: [{ filename: \`ticket-${order.external_reference}.pdf\`, content: pdfBuffer }]`.
- No existe un componente llamado `TicketEmailTemplate`; existe `TicketPDF` (PDF) y la función `sendTicketEmail` (email).

### 6.3 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| PDF en memoria como Buffer | Sí | Ya implementado (toBlob → Buffer). |
| "renderToBuffer" / "TicketEmailTemplate" | No literal | Nuestra API es `pdf()` + `toBlob()`; el nombre del componente es `TicketPDF`. La instrucción es equivalente en concepto; no requiere cambio de implementación. |
| resend.emails.send, to, attachments | Sí | Ya implementado (to = order.user_email, attachment con pdfBuffer). Nombre de archivo distinto (ticket-${external_reference}.pdf) es aceptable. |

---

## 7. Instrucciones de código (NextRequest, try/catch, crypto)

### 7.1 Instrucción

- Usar `NextRequest` y `NextResponse`.
- Manejar errores con try/catch; error interno → 500 (reintento MP); error lógico irrecuperable → 200 (detener reintentos).
- Importar `crypto` de `'node:crypto'`.

### 7.2 Código actual

- Se usa `Request` (Web API) y `NextResponse`. En App Router el handler recibe `Request`; `NextRequest` extiende `Request`; usar `Request` es válido.
- try/catch global; en errores se retorna casi siempre 200 para evitar reintentos. No se distingue explícitamente error transitorio (500) vs lógico (200).
- `import crypto from 'crypto'`; en Node ambos `'crypto'` y `'node:crypto'` son válidos.

### 7.3 Conclusión

| Aspecto | ¿Aplicable? | Comentario |
|--------|-------------|------------|
| NextRequest | Opcional | No necesario; `Request` es suficiente. Si se quiere alinear con la instrucción, se puede tipar como `NextRequest` sin impacto funcional. |
| try/catch y 500 vs 200 | Parcial | Útil refinar: devolver 500 solo en fallos claramente transitorios (p. ej. timeout de Supabase o de MP) para que MP reintente; 200 en errores de validación, negocio o firma para no reintentar. |
| crypto desde 'node:crypto' | Opcional | Buena práctica usar `'node:crypto'`; cambio menor. |

---

## 8. Resumen: qué es útil y qué no aplica

### 8.1 No aplicar / corregir en la interpretación

1. **"Extrae el data.id del body" para el manifest:** Incorrecto. Para la firma, `data.id` debe tomarse de **query params** de la URL (documentación MP y código actual correcto). No cambiar.
2. **"TicketEmailTemplate" / "renderToBuffer":** Nombres genéricos; nuestra implementación (TicketPDF, pdf().toBlob(), sendTicketEmail) es correcta; no obligatorio renombrar o cambiar API.

### 8.2 Aplicable y recomendado

1. **Check de monto:** Añadir validación `payment.transaction_amount` vs `order.amount` (con tolerancia o enteros para CLP); si difieren, no marcar como paid y retornar 200 (o 400) y log.
2. **status_detail === 'accredited':** Verificar en documentación de Payments de MP si es obligatorio para aprobados; si sí, añadir condición antes de considerar el pago aprobado para nuestro flujo.
3. **Cliente Supabase:** Usar `requireSupabaseAdmin()` en este route para ser explícitos (Service Role).
4. **Manejo de errores:** Definir política: 500 solo para errores transitorios (reintento MP), 200 para el resto (firma inválida, orden no encontrada, monto distinto, etc.).
5. **Import:** `import crypto from 'node:crypto'` (opcional).

### 8.3 Ya cumplido (sin cambio)

- Firma HMAC obligatoria; no procesar si falla; 401.
- Origen de `data.id` para manifest = query param.
- payment.get como fuente de verdad; ignorar estado del body.
- Búsqueda de orden por external_reference.
- Idempotencia (paid → 200, no PDF/email duplicado).
- Update atómico pending → paid con mp_payment_id.
- PDF en Buffer y envío por Resend a order.user_email con adjunto.

---

## 9. Información que falta para ≥98% de comprensión

- **status_detail:** Valores posibles de `status_detail` en la respuesta de Get payment para pagos aprobados en Checkout Pro (Chile/CLP). Si solo `accredited` es válido, la condición es segura; si hay otros, hace falta criterio (aceptar o rechazar).
- **Comportamiento de MP ante 400:** Si al "lanzar error" por monto distinto retornamos 400, confirmar si MP reintenta o no; si reintenta indefinidamente, preferir 200 + log para ese caso.

---

## 10. Conclusión

- Las instrucciones son en su mayoría **útiles y alineadas** con el flujo actual, con dos excepciones importantes: (1) el manifest debe usar `data.id` de **query params**, no del body; (2) nombres concretos (TicketEmailTemplate, renderToBuffer) no coinciden con el proyecto pero el comportamiento ya está cubierto.
- **Aplicable a nuestra realidad:** validación de monto, opcionalmente status_detail, uso explícito de `requireSupabaseAdmin()`, y refinamiento 500/200. **No aplicar:** usar `data.id` del body para la firma del webhook.
