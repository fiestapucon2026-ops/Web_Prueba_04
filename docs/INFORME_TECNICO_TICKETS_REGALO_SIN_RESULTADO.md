# Informe técnico: tickets de regalo — no se obtienen tickets en pantalla ni PDF

**Fecha:** 2026-02-17  
**Contexto:** El usuario genera tickets de regalo desde `/admin/tickets-regalo` (fecha 2026-02-20) y no logra obtener los tickets en pantalla ni como PDF. El POST al API retorna 200 OK.

---

## 1. Arquitectura del flujo

```
[Usuario] POST /admin/tickets-regalo (Generar tickets regalo)
    → POST /api/admin/tickets/gifts { date, kind, quantity }
    → create_orders_atomic (Supabase RPC)
    → UPDATE orders SET status='paid'
    → INSERT tickets (Supabase)
    → INSERT job_queue (type: generate_ticket_pdf)
    → Retorna 200 OK

[Asíncrono — NO se ejecuta automáticamente]
    → CRON EXTERNO invoca GET /api/workers/process-tickets
        → Lee jobs pending de job_queue
        → Genera PDF (generateTicketsPDF)
        → Sube a Supabase Storage (bucket 'tickets')
        → Envía email (Resend) a regalos@festivalpucon.cl
        → UPDATE job_queue SET status='completed'
```

**Punto crítico:** El worker `GET /api/workers/process-tickets` **no se ejecuta automáticamente**. Debe ser invocado por un **cron externo** (p. ej. cron-job.org, Vercel Cron) con `Authorization: Bearer <CRON_SECRET>`.

---

## 2. Problemas identificados

### 2.1 No hay entrega en pantalla

**Descripción:** La UI `/admin/tickets-regalo` nunca muestra tickets ni enlace de descarga.

**Causa técnica:** El flujo actual solo:
- Crea filas en `orders` y `tickets` (BD)
- Encola un job en `job_queue`
- Muestra el mensaje: "Tickets regalo creados. PDF y email se enviarán a regalos@festivalpucon.cl en unos minutos."

**No existe:**
- Endpoint ni lógica para generar PDF al vuelo y devolverlo al cliente.
- Enlace de descarga en la UI tras la generación.
- Visualización de QR/tickets en pantalla.

### 2.2 No llega PDF por email

**Causa raíz probable:** El worker que genera el PDF y envía el email **no se está ejecutando**.

**Condiciones necesarias:**
1. **Cron configurado:** Algún servicio debe llamar periódicamente a `GET https://www.festivalpucon.cl/api/workers/process-tickets` con header `Authorization: Bearer <CRON_SECRET>`.
2. **Variable CRON_SECRET:** Definida en Vercel con el mismo valor que usa el cron.
3. **Variable RESEND_API_KEY:** Definida en Vercel (el build muestra "RESEND_API_KEY no configurado" si no está).
4. **Supabase Storage bucket 'tickets':** Debe existir y tener políticas que permitan INSERT con service_role.

**Puntos de fallo:**
| # | Punto de fallo | Efecto |
|---|----------------|--------|
| 1 | Cron no configurado o URL incorrecta | Los jobs quedan en `status='pending'` indefinidamente. |
| 2 | CRON_SECRET incorrecto o no definido | El worker retorna 401; el cron no procesa. |
| 3 | RESEND_API_KEY no definido | `sendPurchaseEmail` lanza y el job pasa a `failed` tras reintentos. |
| 4 | Bucket 'tickets' inexistente o políticas incorrectas | Error en `supabase.storage.from(BUCKET).upload(...)`. |
| 5 | Error en job_queue.insert | Solo se loguea; el API retorna 200 igual. El PDF nunca se encola. |

### 2.3 Fallo silencioso al encolar el job

**Archivo:** `src/app/api/admin/tickets/gifts/route.ts` (aprox. líneas 251–263)

```typescript
const { error: jobErr } = await supabase.from('job_queue').insert({...});
if (jobErr) {
  console.error('[gifts] Error al encolar PDF:', jobErr);
}
return NextResponse.json({ ok: true, ... });  // Siempre 200
```

Si `job_queue.insert` falla (p. ej. tabla inexistente, RLS, schema), el API sigue devolviendo 200 OK. El usuario cree que todo fue bien, pero no hay job que procesar.

---

## 3. Verificaciones técnicas recomendadas

### 3.1 Base de datos (Supabase)

```sql
-- ¿Existen jobs de tickets regalo?
SELECT id, type, status, last_error, created_at, attempts
FROM job_queue
WHERE type = 'generate_ticket_pdf'
ORDER BY created_at DESC
LIMIT 20;

-- ¿Se crearon órdenes y tickets para regalos?
SELECT o.id, o.external_reference, o.status, o.user_email, COUNT(t.id) AS tickets_count
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
WHERE o.user_email = 'regalos@festivalpucon.cl'
GROUP BY o.id, o.external_reference, o.status, o.user_email
ORDER BY o.created_at DESC
LIMIT 10;
```

Interpretación:
- `job_queue.status = 'pending'` y jobs antiguos → el cron no está llamando al worker o la URL/auth falla.
- `job_queue.status = 'failed'` → revisar `last_error`.
- Sin filas en `job_queue` para esos `external_reference` → falló el `job_queue.insert` (o no se desplegó el código que lo hace).

### 3.2 Cron externo

- **URL:** `https://www.festivalpucon.cl/api/workers/process-tickets` (GET).
- **Headers:** `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret: <CRON_SECRET>`.
- **Frecuencia:** Cada 1–5 minutos.
- **Verificación:** Llamar manualmente con curl y CRON_SECRET correcto; debe retornar 200 y `{ processed: N }`.

### 3.3 Variables de entorno (Vercel)

| Variable | Uso |
|----------|-----|
| CRON_SECRET | Autorización del worker process-tickets |
| RESEND_API_KEY | Envío de email con link al PDF |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | Lectura/escritura BD y Storage |

### 3.4 Storage Supabase

- Bucket `tickets` debe existir.
- Políticas: service_role puede hacer INSERT; público (o signed URL) para lectura del PDF.

---

## 4. Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `src/app/admin/tickets-regalo/page.tsx` | UI del formulario; no muestra PDF ni enlace. |
| `src/app/api/admin/tickets/gifts/route.ts` | POST: crea orden, tickets, encola job. |
| `src/app/api/workers/process-tickets/route.ts` | GET: procesa job_queue, genera PDF, sube a Storage, envía email. |
| `src/lib/pdf.tsx` | `generateTicketsPDF` — genera el buffer del PDF. |
| `src/lib/email.ts` | `sendPurchaseEmail` — envía email vía Resend. |
| `supabase/migrations/job_queue_and_tickets_storage_sin_drop.sql` | Schema job_queue y bucket tickets. |

---

## 5. Resumen ejecutivo

**Problema principal:** No hay forma de "sacar" tickets en pantalla; el flujo depende de un worker asíncrono invocado por cron externo que genera PDF y envía email. Si el cron no se ejecuta o fallan RESEND/Storage, no se entrega nada al usuario.

**Hipótesis más probable:** El cron no está configurado o no llama correctamente a `/api/workers/process-tickets`, por lo que los jobs permanecen en `pending` y nunca se generan PDF ni se envían emails.

**Acciones sugeridas:**
1. Confirmar si existe un cron (Vercel Cron o externo) que llame a `/api/workers/process-tickets` con CRON_SECRET.
2. Revisar `job_queue` en Supabase: status, `last_error`, antigüedad de los jobs.
3. Verificar RESEND_API_KEY y dominio Resend.
4. Si se requiere entrega inmediata en pantalla, diseñar un flujo adicional: generar PDF en la respuesta del POST o exponer un endpoint de descarga que genere el PDF al vuelo para la orden recién creada.
