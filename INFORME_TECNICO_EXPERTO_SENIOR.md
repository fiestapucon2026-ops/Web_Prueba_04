# Informe técnico para experto senior — Módulo entradas / Success / access-token

**Proyecto:** web_oficial_festival (Next.js 14+, TypeScript, Vercel, Supabase, Mercado Pago)  
**Área:** Flujo post-pago → token de acceso → Mis entradas → QR/PDF.  
**Estado:** Se aplicaron varias correcciones; el síntoma principal (404 en access-token) persistía en las pruebas del usuario. Último cambio (aceptar órdenes `pending` en access-token) no ha sido validado en producción por petición del usuario. Este documento resume problema, arquitectura, soluciones intentadas y punto en el que se considera bloqueado.

---

## 1. Problema desde el inicio

### 1.1 Síntoma principal

En la página **Venta exitosa** (`/success?external_reference=...&collection_id=...&collection_status=approved`) el usuario **nunca** ve el botón **"Ver e imprimir mis entradas"**. En su lugar ve el botón principal **"Ir a www.festivalpucon.cl"** (fallback).

- La página hace **polling** a `GET /api/orders/access-token?external_reference=<uuid>` (cada 2 s, hasta 10 intentos).
- **Todas** las peticiones devuelven **HTTP 404**.
- Al no recibir `{ token }`, el estado `misEntradasUrl` nunca se setea y el CTA principal sigue siendo `redirectUrl`.

### 1.2 Datos concretos observados

- **URL de success:** `https://www.festivalpucon.cl/success?external_reference=89877aad-d370-442a-8d6a-4906dfd8879e&collection_id=143770659357&collection_status=approved&paym...`
- **Peticiones:** Múltiples `GET https://www.festivalpucon.cl/api/orders/access-token?external_reference=89877aad-d370-442a-8d6a-4906dfd8879e` → **HTTP/2 404** (varios intentos, ~200–2100 ms cada uno).
- **Variables de entorno en Vercel:** `QR_SIGNING_SECRET` y `CRON_SECRET` están definidas (confirmado por el usuario).

### 1.3 Síntomas secundarios (ya abordados en código)

- **Mis entradas con token en URL:** Si el token viajaba en query (`/mis-entradas?token=...`), en algunos casos la URL se truncaba y la API `GET /api/orders/by-reference?token=...` fallaba → pantalla "Error al cargar".
- **PDF:** El usuario preguntó qué se imprime y de dónde sale la imagen. El PDF se genera en servidor (worker + `src/lib/pdf.tsx`), no hay archivo estático; el QR en el PDF se genera con la librería `qrcode` desde `qr_uuid` del ticket. Además se añadió QR en pantalla en Mis entradas (TicketCard) para que quien tenga celular pueda capturar/imprimir pantalla.

---

## 2. Arquitectura relevante (resumen)

### 2.1 Creación de orden y redirect

- **Entradas (múltiples ítems):** `POST /api/entradas/create-preference` genera `external_reference` (UUID), crea preferencia en MP con ese `external_reference`, **inserta** filas en `orders` con `status = 'pending'`, devuelve `init_point`.
- **Tickets (un ítem):** `POST /api/tickets/create-preference` (o delegación desde entradas) crea orden con `status = 'pending'` y mismo flujo.
- MP redirige al usuario a `successUrl` (p. ej. `${baseUrl}/success?external_reference=${externalReference}`). MP puede añadir `collection_id`, `collection_status`, `payment_id`, etc.

### 2.2 Webhook Mercado Pago

- **POST /api/webhooks/mercadopago:** Firma validada con `MP_WEBHOOK_SECRET`. Si `payment.status === 'approved'`:
  - Busca órdenes por `payment.external_reference`.
  - Actualiza a `status = 'paid'` y setea `mp_payment_id`.
  - Crea filas en `tickets` (una por unidad) con `qr_uuid` (gen_random_uuid).
  - Inserta un job en `job_queue` (type `generate_ticket_pdf`, payload: `external_reference`, `order_ids`, `email`).
- No genera PDF ni envía email en el webhook; eso lo hace el worker.

### 2.3 access-token (el endpoint que devuelve 404)

- **GET /api/orders/access-token:** Acepta `external_reference` (UUID) o `payment_id`/`collection_id`.
- **Con `external_reference`:** Busca en `orders` una fila con ese `external_reference`. **Hasta el último cambio:** se exigía además `status = 'paid'`. **Tras el último cambio:** se quitó el filtro por status; se devuelve token si existe **cualquier** orden con ese `external_reference` (pending o paid).
- **Con `payment_id`:** Busca orden por `mp_payment_id` y `status = 'paid'`, obtiene `external_reference` y devuelve token.
- Token: `createAccessToken(external_reference)` (HMAC con `QR_SIGNING_SECRET`, TTL 7 días). Se usa en Mis entradas para autorizar la consulta.

### 2.4 Página Success (cliente)

- Lee `external_reference` y `collection_id`/`payment_id` de la URL; si `collection_status`/`status` es approved, hace polling a access-token (primero con `external_reference` si existe).
- Si la respuesta es 200 y `data.token`, guarda el token en `sessionStorage` bajo `mis_entradas_token` y setea `misEntradasUrl = '/mis-entradas'` (sin query).
- El botón principal es "Ver e imprimir mis entradas" (href `/mis-entradas`) si `misEntradasUrl` está seteo; si no, es "Ir a www.festivalpucon.cl".

### 2.5 Mis entradas y by-reference

- **GET /api/orders/by-reference?token=...:** Verifica token con `verifyAccessToken` (mismo `QR_SIGNING_SECRET`). Si falla → 401. Si ok, busca órdenes con ese `external_reference` y **`status = 'paid'`**. Si no hay órdenes → 404. Devuelve órdenes + tickets (con `qr_uuid` como `qr_token`).
- Página Mis entradas: token desde query o desde `sessionStorage`; llama a by-reference; si hay token de sessionStorage y carga ok, lo borra de sessionStorage.

### 2.6 Worker y PDF

- **GET /api/workers/process-tickets:** Protegido con `Authorization: Bearer <CRON_SECRET>`. Lee jobs `pending` de `job_queue` (type `generate_ticket_pdf`), genera PDF (`generateTicketsPDF` en `src/lib/pdf.tsx`), sube a bucket Storage `tickets`, envía email (Resend) con enlace al PDF y token para Mis entradas. Invocado por cron externo (p. ej. cada 5 min).

---

## 3. Soluciones implementadas y avances

### 3.1 Token en URL truncado → sessionStorage

- **Problema:** En `/mis-entradas?token=...` el token largo se truncaba en la URL → by-reference fallaba → "Error al cargar".
- **Solución:** En Success, al recibir token de access-token se guarda en `sessionStorage` y el enlace pasa a ser solo `/mis-entradas`. En Mis entradas se lee token de query o de sessionStorage.
- **Avance:** Evita truncado cuando el usuario viene desde Success. No corrige el 404 de access-token (que impedía que hubiera token).

### 3.2 Exigir orden `paid` en access-token (y luego quitarlo)

- **Primera versión:** access-token con `external_reference` solo devolvía token si existía una orden con ese `external_reference` y **`status = 'paid'`** (para no dar token antes de que el webhook actualizara).
- **Efecto:** 404 persistente porque el usuario llega a Success antes (o casi al mismo tiempo) que el webhook actualiza la orden a `paid`.
- **Cambio posterior:** Se eliminó el filtro `.eq('status', 'paid')` cuando se busca por `external_reference`. Se devuelve token si existe **cualquier** orden con ese `external_reference` (pending o paid). Objetivo: que el botón "Ver e imprimir mis entradas" aparezca de inmediato; en Mis entradas, si la orden sigue pending, by-reference devuelve 404 y el usuario puede usar "Reintentar" hasta que el webhook actualice.
- **Estado:** Este cambio está en código pero **no** se ha desplegado ni validado en producción por indicación del usuario ("ya no ejecutes más códigos").

### 3.3 Más intentos de polling

- **Cambio:** POLL_ATTEMPTS de 5 a 10 (intervalo 2 s) → hasta ~20 s de espera.
- **Efecto:** Sigue habiendo 404 en todas las peticiones en las pruebas reportadas; no se observó 200 en ningún intento.

### 3.4 Diferenciar 401 y 404 en by-reference

- **Cambio:** Si `verifyAccessToken` falla → 401 "Token no válido o expirado". Si no hay órdenes `paid` → 404.
- **Avance:** Permite distinguir en logs/cliente si el fallo es por token o por ausencia de órdenes pagadas.

### 3.5 Reintentos y mensaje en Mis entradas

- **Cambio:** SWR con `errorRetryCount: 3`, `errorRetryInterval: 4000`, botón "Reintentar" y mensaje "Si acabas de comprar, las entradas pueden tardar unos segundos".
- **Avance:** Mejor UX cuando by-reference falla temporalmente (p. ej. webhook aún no corrió).

### 3.6 Video y ventana "Preparando tus entradas"

- **Cambio:** En Success, mientras se espera token (`misEntradasUrl == null` y pago aprobado), se muestra una ventana con video (`/videos/imprimiendo-ticket.mp4`) y texto "Preparando tus entradas...".
- **Avance:** UX durante la espera; no afecta al 404.

### 3.7 QR en pantalla (Mis entradas)

- **Cambio:** En `TicketCard` se genera en cliente la imagen del QR con `qrcode.toDataURL(ticket.qr_token)` y se muestra en la tarjeta.
- **Avance:** El usuario puede capturar pantalla o imprimir la página y usar eso como ticket; no depende del PDF para ver el QR.

---

## 4. Dónde se considera el problema y por qué no se avanza más

### 4.1 Hipótesis del 404 en access-token

Con los datos disponibles (404 sistemático para `external_reference=89877aad-d370-442a-8d6a-4906dfd8879e`), las causas posibles son:

1. **No existe orden con ese `external_reference` en la base usada por la API.**  
   - create-preference podría no estar insertando en el mismo proyecto/BD que usa Vercel.  
   - O el flujo de compra usado en la prueba no es el que inserta en `orders` con ese UUID (p. ej. otro producto o otra URL de preferencia).

2. **La orden existe pero la consulta falla.**  
   - `requireSupabaseAdmin()` (service role) vs políticas RLS o conexión a otro proyecto.  
   - Variables de entorno en Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) apuntando a otro proyecto o clave incorrecta.  
   - Error en la query (nombre de tabla/columna, tipo de `external_reference`) que se traduce en 404.

3. **Orden existe con ese `external_reference` pero con `status = 'pending'` y antes se exigía `status = 'paid'`.**  
   - Esta fue la hipótesis que llevó al último cambio: quitar el filtro por status cuando se busca por `external_reference`.  
   - No se ha podido validar en producción; si tras desplegar el 404 persiste, la causa estaría en (1) o (2).

### 4.2 Soluciones que no resolvieron el síntoma principal

- **Exigir `status = 'paid'` en access-token para `external_reference`:** 404 seguía (y llevó a aceptar también pending).
- **Aumentar intentos de polling (10 × 2 s):** 404 en todos los intentos; no hubo ningún 200.
- **SessionStorage para no truncar token:** Mejora el flujo Mis entradas cuando sí hay token, pero no evita el 404 en access-token.
- **Diferenciar 401/404 en by-reference, Reintentar, video, QR en pantalla:** No atacan la causa del 404 en access-token.

### 4.3 Lo que no se pudo verificar (falta de datos)

- **Contenido de la base de datos:** No se ejecutó en el entorno del usuario la consulta a `orders` filtrando por `external_reference = '89877aad-d370-442a-8d6a-4906dfd8879e'` (existencia de la fila, valor de `status`, de `mp_payment_id`).
- **Ejecución del webhook:** No hay logs de Vercel ni de MP que confirmen que el webhook recibe el pago aprobado y que actualiza la orden a `paid` (y encola el job).
- **Respuesta exacta del 404:** No se tiene el body JSON de la respuesta 404 de access-token (solo se sabe que es 404); en el código se devuelve `{ error: 'No encontrado' }` cuando no hay fila o la query falla.

---

## 5. Recomendaciones para el experto senior

1. **Confirmar en Supabase** (mismo proyecto que usa Vercel):  
   Tras una compra de prueba con `external_reference` conocido, ejecutar algo como:
   ```sql
   SELECT id, external_reference, status, mp_payment_id, created_at
   FROM public.orders
   WHERE external_reference::text = '<external_reference de la URL de success>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   Verificar: existe la fila, valor de `status` (pending/paid), si `mp_payment_id` está rellenado.

2. **Confirmar webhook:**  
   En Mercado Pago, revisar URL de notificación y entregas. En Vercel (Logs/Functions), comprobar si llega POST a `/api/webhooks/mercadopago` tras el pago y qué status/body se devuelve. Si el webhook no se llama o falla (firma, 500), las órdenes pueden quedar en `pending` y `job_queue` sin jobs.

3. **Verificar acceso a BD desde access-token:**  
   Misma cuenta Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) que en create-preference; sin RLS que bloquee al service role; nombre de tabla `orders` y columna `external_reference` (tipo UUID o texto según esquema).

4. **Desplegar y probar el último cambio de access-token:**  
   Asegurarse de que en producción está la versión que **no** filtra por `status = 'paid'` cuando se busca por `external_reference`. Hacer una compra de prueba y comprobar si access-token pasa a devolver 200 con `token` y si el botón "Ver e imprimir mis entradas" aparece.

5. **Si el 404 continúa tras (1)–(4):**  
   Añadir logging en access-token (por ejemplo: `external_reference` recibido, resultado de la query a `orders` — count o primera fila —, y error de Supabase si existe) para ver si el fallo es "no fila" o "error de query/conexión". Con eso se puede distinguir entre orden inexistente y problema de configuración/BD.

---

## 6. Archivos y rutas clave

| Archivo / ruta | Rol |
|----------------|-----|
| `src/app/success/page.tsx` | Página Success; polling a access-token; sessionStorage; video; botones. |
| `src/app/api/orders/access-token/route.ts` | GET; busca orden por `external_reference` (sin filtrar por status en la última versión) o por `payment_id` (con status `paid`); devuelve token. |
| `src/app/api/orders/by-reference/route.ts` | GET; verifica token; devuelve órdenes `paid` + tickets. |
| `src/app/api/webhooks/mercadopago/route.ts` | POST; actualiza órdenes a `paid`, crea tickets, inserta en `job_queue`. |
| `src/app/mis-entradas/page.tsx` | Lee token de URL o sessionStorage; llama by-reference; muestra entradas y QR. |
| `src/components/TicketCard.tsx` | Muestra QR en pantalla (qrcode.toDataURL en cliente). |
| `src/lib/security/access-token.ts` | createAccessToken / verifyAccessToken (QR_SIGNING_SECRET). |
| `src/app/api/workers/process-tickets/route.ts` | Procesa job_queue; genera PDF; Storage; email. |
| `respaldo_pre_tickets_qr/orders_access_token_route_antes_accept_pending.bak` | Respaldo de access-token antes de aceptar órdenes pending. |

---

## 7. Variables de entorno críticas (Vercel)

- **QR_SIGNING_SECRET:** Requerida para access-token y by-reference (crear/verificar token). Sin ella, access-token puede devolver 500.
- **CRON_SECRET:** Para autorizar GET al worker process-tickets.
- **SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY:** Misma cuenta que la usada al crear órdenes y donde está `job_queue`.
- **MP_WEBHOOK_SECRET:** Firma del webhook de Mercado Pago.
- **RESEND_API_KEY:** Envío del email con enlace al PDF.

---

Fin del informe. No se ha ejecutado código adicional; el último cambio en access-token (aceptar órdenes pending por `external_reference`) está en código y pendiente de despliegue y validación por el experto senior.
