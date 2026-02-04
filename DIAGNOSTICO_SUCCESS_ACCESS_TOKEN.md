# Diagnóstico: por qué no aparece "Ver e imprimir mis entradas"

Para poder corregir el fallo sin suposiciones, necesitamos esta información **después de una compra de prueba** (usa el mismo `external_reference` que ves en la URL de success).

---

## 1. Respuesta exacta de la API access-token

En la página **Venta exitosa** (`/success?external_reference=...`):

1. Abre **DevTools** (F12).
2. Pestaña **Red (Network)**.
3. Filtra por **XHR** o busca la petición a `access-token`.
4. Haz clic en una petición `access-token?external_reference=...`.
5. Anota:
   - **Estado (Status):** ¿200, 404, 500, otro?
   - **Respuesta (Response):** pestaña "Response" o "Vista previa" → ¿qué JSON devuelve? (ej. `{ "error": "No encontrado" }` o `{ "token": "..." }`).

Copia y pega aquí el **Status** y el **body de la respuesta** de una de esas peticiones.

---

## 2. Estado de la orden en Supabase

En **Supabase → SQL Editor**, ejecuta (sustituye `DA6E8EC4-7...` por el inicio de tu `external_reference` de la URL de success):

```sql
-- Sustituir XXXXX por los primeros caracteres de tu external_reference
SELECT id, external_reference, status, mp_payment_id, user_email, created_at
FROM public.orders
WHERE external_reference::text LIKE 'da6e8ec4-7%'
ORDER BY created_at DESC
LIMIT 5;
```

Indica:
- ¿Aparece alguna fila?
- Para esa compra: ¿`status` es `pending` o `paid`?
- ¿`mp_payment_id` tiene valor o está NULL?

---

## 3. Si el webhook se ejecutó (job_queue)

En **Supabase → SQL Editor**:

```sql
SELECT id, type, status, attempts, last_error, created_at, processed_at, payload
FROM public.job_queue
WHERE type = 'generate_ticket_pdf'
ORDER BY created_at DESC
LIMIT 10;
```

Indica:
- ¿Hay filas con el `external_reference` de tu compra (en `payload`)?
- Para esa compra: ¿`status` es `pending`, `processing`, `completed` o `failed`?
- Si es `failed`: ¿qué pone en `last_error`?

---

## 4. Logs del webhook en Vercel (opcional pero muy útil)

En **Vercel → proyecto → Logs** (o Functions → elegir la función del webhook):

1. Filtra por la hora en que hiciste la compra de prueba.
2. Busca peticiones a `/api/webhooks/mercadopago`.

Indica:
- ¿Llega alguna petición POST al webhook tras el pago?
- Si sí: ¿qué status devuelve (200, 401, 500)?
- Si hay errores en el log, copia el mensaje.

---

## 5. URL de success que usaste

Copia la **URL completa** de la página de success (con `external_reference`, `collection_id`, `status`, etc.), tal como la muestra el navegador después de pagar.

---

Con **1 + 2** ya podemos saber si el fallo es:
- orden no existe,
- orden sigue en `pending` (webhook no actualizó),
- o access-token falla por otro motivo.

Con **3 y 4** vemos si el webhook se ejecuta y si encola el job. Con **5** comprobamos que MP está enviando bien los parámetros.
