# Análisis: secuencia para recuperación 100% (tickets visibles)

**Fecha:** 2026-02-09  
**Alcance:** Solo análisis. Sin ejecución.  
**Objetivo:** Identificar qué modificación no respaldada (o qué condición de entorno/BD) impide ver los tickets tras una venta exitosa, y el punto de recuperación.

---

## 1. Síntomas (logs e imágenes)

- **Vercel Logs:**  
  - `POST /api/webhooks/mercadopago` → **401** — "X Webhook Mercado Pago: verificación de firma fallida: Firma inválida".  
  - `GET /api/orders/by-reference` → **200** pero log: **`[by-reference] Fallback UPDATE error: { code: '23505', details: 'Key (mp_payment_id)=(145569663490) already exists.' }`**
- **Navegador:** Mis entradas muestra "Tu compra está siendo confirmada..." y no pasa a mostrar tickets; las llamadas a `by-reference` devuelven 200 pero el cuerpo sigue con `pending: true` o sin órdenes/tickets.

---

## 2. Cadena causal

### 2.1 Webhook 401 → la orden no pasa a `paid` por el webhook

- El único camino que actualiza órdenes a `paid` en el webhook es **después** de validar la firma.
- Si la firma falla, se responde 401 y **no** se ejecuta el `UPDATE orders SET status='paid', mp_payment_id=...`.
- **Consecuencia:** Las órdenes quedan en `pending` y sin `mp_payment_id` vía webhook.

**Causa de "Firma inválida":** No es un cambio de código sin respaldo. Según `INFORME_EXPERTO_WEBHOOK_TICKETS_CALLEJON.md`, `MP_WEBHOOK_SECRET` fue verificado varias veces. Las causas probables son: formato del manifest (orden de campos, uso de `data.id` en query vs body), tolerancia del timestamp, o que MP en producción use otro esquema de firma. Es un tema de **configuración / formato**, no de “código que se borró”.

### 2.2 Fallback by-reference → UPDATE falla con 23505

- Como el webhook no actualiza, Mis entradas hace polling a `GET /api/orders/by-reference?token=...`.
- by-reference no encuentra órdenes `paid`, consulta a MP, obtiene pago `approved` y ejecuta:

```ts
await supabase
  .from('orders')
  .update({ status: 'paid', mp_payment_id: paymentId })
  .eq('external_reference', externalReference)
  .eq('status', 'pending')
  .select('id');
```

- En **entradas** hay **varias órdenes** con el mismo `external_reference` (ej. entrada + estacionamiento = 2 filas), creadas por `create_orders_atomic` (una fila por ítem).
- Ese `UPDATE` intenta poner el **mismo** `mp_payment_id` en **todas** esas filas.
- El error **23505** = violación de **UNIQUE**: en la base de datos de producción existe una restricción **UNIQUE sobre `mp_payment_id`**.
- Al actualizar la segunda fila con el mismo `mp_payment_id`, la restricción falla → todo el `UPDATE` falla → by-reference captura el error, hace `return` con `pending: true` y no llama a `processApprovedOrder` → el usuario nunca ve tickets.

**Conclusión:** La modificación que **no está en el repo** pero **sí está en producción** es la restricción **UNIQUE(mp_payment_id)** en la tabla `orders`. En el repositorio no hay ninguna migración que cree esa restricción (ver `AUDITORIA_INFRAESTRUCTURA_TICKETS_QR_EMAIL.md`: "No aparece en el repo ninguna restricción UNIQUE sobre mp_payment_id"). Fue añadida en la BD real (manual o migración no versionada) y es **incompatible** con el modelo de negocio: un pago de MP (un `payment_id`) puede tener **varias** órdenes (varias filas en `orders` con el mismo `external_reference`).

---

## 3. Secuencia de hechos (resumen)

| Paso | Qué pasa | Efecto |
|------|----------|--------|
| 1 | Usuario paga en MP; MP envía webhook a `/api/webhooks/mercadopago`. | - |
| 2 | Webhook valida firma → falla → 401. | No se ejecuta UPDATE de órdenes a `paid`. |
| 3 | Órdenes siguen `pending`, sin `mp_payment_id`. | - |
| 4 | Usuario en Mis entradas; front hace polling a by-reference. | by-reference no encuentra órdenes `paid`. |
| 5 | by-reference hace fallback: consulta MP, ve pago `approved`. | - |
| 6 | by-reference hace `UPDATE orders SET status='paid', mp_payment_id=... WHERE external_reference=? AND status='pending'`. | Hay 2+ filas; todas reciben el mismo `mp_payment_id`. |
| 7 | En BD existe UNIQUE(mp_payment_id). | La segunda fila viola UNIQUE → 23505. |
| 8 | by-reference captura el error y devuelve `pending: true`. | No se llama a `processApprovedOrder`; no se crean tickets ni job PDF/email. |
| 9 | Front sigue mostrando "Procesando tu pago". | Usuario no ve tickets. |

---

## 4. Qué no es “código no respaldado”

- **Código actual** (by-reference, webhook, process-approved-order, create_orders_atomic) está en el repo y es coherente: varias órdenes por `external_reference`, un solo `payment_id` por pago.
- **Idempotencia en email/worker** (commit 3c94255) ya se revirtió con el rollback a 8043457; no es la causa de los logs que ves ahora.
- **Respaldos** en `respaldo_pre_tickets_qr/`, `respaldo_pre_mp_produccion/` no cambian este diagnóstico: el fallo viene de **BD (UNIQUE)** y **webhook (firma)**, no de una versión antigua de un archivo.

---

## 5. Punto de recuperación (qué hacer para llegar al 100%)

Para que el sistema muestre tickets tras una venta exitosa hace falta que **al menos uno** de los dos caminos funcione:

- **Opción A — Webhook:** Que la firma del webhook sea válida (mismo secret, manifest y reglas que MP usa). Entonces el webhook actualiza órdenes a `paid` y setea `mp_payment_id`; el worker genera tickets y PDF. No requiere tocar by-reference.
- **Opción B — Fallback by-reference:** Que el `UPDATE` de by-reference no falle. Eso **obliga** a que en la BD **no** exista UNIQUE sobre `mp_payment_id`, porque un mismo pago debe poder actualizar **varias** órdenes con el mismo `mp_payment_id`.

**Recuperación recomendada (orden):**

1. **Base de datos (producción Supabase)**  
   - Ejecutar la migración `supabase/migrations/20260209_drop_orders_mp_payment_id_unique.sql` en el proyecto Supabase (SQL Editor o `supabase db push`). Esa migración elimina la restricción UNIQUE en `orders.mp_payment_id` si existe. Un mismo `mp_payment_id` puede corresponder a varias filas de `orders` (varias órdenes por mismo `external_reference`).

2. **Webhook (opcional pero recomendado)**  
   - Revisar en el panel de MP la “Clave secreta” del webhook y que coincida con `MP_WEBHOOK_SECRET` en Vercel.  
   - Revisar documentación de MP para el cálculo del manifest (orden de campos, uso de `data.id` en query/body, timestamp en segundos vs ms) y alinear `verifyMercadoPagoSignature` si hace falta.  
   - Cuando la firma sea válida, el webhook actualizará órdenes y encolará jobs; el fallback de by-reference pasará a ser solo respaldo.

Con **1** resuelto, el fallback de by-reference debería poder actualizar todas las órdenes del mismo `external_reference` a `paid` con el mismo `mp_payment_id`, llamar a `processApprovedOrder` y mostrar tickets en Mis entradas incluso cuando el webhook siga fallando. Con **1 + 2**, el flujo queda 100% por webhook y by-reference como respaldo.

---

## 6. Resumen ejecutivo

- **Modificación no respaldada / fuera del repo:** Restricción **UNIQUE(mp_payment_id)** en la tabla `orders` en la base de datos de producción. No aparece en migraciones del repo; rompe el fallback cuando hay varias órdenes por mismo pago.
- **Segunda causa (no código):** Firma del webhook inválida (401), por configuración o formato del manifest, no por código perdido.
- **Punto de recuperación:**  
  - **Código:** Mantener 8043457 (o el commit actual que ya está en esa línea).  
  - **BD:** Quitar UNIQUE en `orders.mp_payment_id`.  
  - **Opcional:** Corregir firma del webhook (secret + formato) para que el camino principal funcione.

No se ha ejecutado ninguna acción; este documento es solo análisis.
