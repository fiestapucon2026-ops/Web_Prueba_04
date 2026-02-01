# Revisión puntos 6, 7 y 8 del flujo E2E

**Estado:** Hasta el punto 5 todo corre bien (compra en MP, stock se rebaja). Lo último que se ve es la página de éxito de Mercado Pago (congrats/approved). Los puntos 6, 7 y 8 deben revisarse.

---

## Punto 6: MP redirige a nuestra `/success`

**Objetivo:** Tras el pago aprobado, el usuario debe llegar a  
`https://www.festivalpucon.cl/success?external_reference=XXX&status=approved`  
(o la URL base que use tu entorno).

**Qué hace el código (sin tocar archivos):**

- El flujo de 1 ítem usa **tickets/create-preference**.
- Ahí se envía a MP:
  - `back_urls.success` = `baseUrl + '/success'`
  - `baseUrl` = `process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl'`
  - `auto_return: 'approved'` (siempre)

Es decir, MP **tiene** la URL de éxito y la instrucción de volver automáticamente. Si te quedas en la pantalla de “¡Listo! Tu pago ya se acreditó” de MP, puede ser:

1. **MP muestra primero la congrats y el “volver” es manual**  
   En muchas integraciones MP muestra la congrats y un botón/enlace tipo **“Volver al comercio”**, **“Continuar”** o **“Ver mi compra”**. Ese enlace es el que lleva a nuestra `back_urls.success`.  
   **Qué hacer:** En esa misma pantalla de MP, buscar y hacer clic en ese enlace. Deberías ir a `.../success?external_reference=...&status=approved`.

2. **La URL de éxito que recibe MP es incorrecta**  
   Si en el entorno donde compras (producción) `NEXT_PUBLIC_BASE_URL` no está bien, MP podría estar recibiendo una URL que no es la de tu sitio.  
   **Qué revisar (sin tocar código):**
   - En **Vercel** → proyecto → **Settings** → **Environment Variables**.
   - Para el entorno donde hiciste la compra (Production o Preview), confirmar que existe `NEXT_PUBLIC_BASE_URL`.
   - En producción debería ser: `https://www.festivalpucon.cl` (sin barra final).
   - Si falta o está mal, corregir y volver a desplegar; luego repetir una compra de prueba.

**Resumen punto 6:**  
- Probar primero: en la pantalla de MP, hacer clic en “Volver al comercio” / “Continuar” y comprobar si llegas a `/success?...`.  
- Si no hay ese enlace o no te lleva a nuestro sitio: revisar `NEXT_PUBLIC_BASE_URL` en Vercel para ese entorno.  
- No se modifican `entradas/create-preference` ni `tickets/create-preference`.

---

## Punto 7: Página `/success` → token → redirección a `/mis-entradas`

**Objetivo:** En nuestra `/success`, la página hace polling a `/api/orders/access-token`, obtiene el token y redirige (o muestra enlace) a `/mis-entradas?token=XXX`.

**Estado del código:**  
La página `src/app/success/page.tsx` ya tiene:

- Lectura de `external_reference` y `status` desde la URL.
- Si `status === 'approved'`, polling cada 2 s a `/api/orders/access-token?external_reference=...`.
- Cuando llega el token, construye `/mis-entradas?token=...` y redirige (o muestra “Ver mis entradas” y al terminar la cuenta regresiva redirige ahí).

**Qué revisar (cuando el punto 6 funcione):**

- Que al llegar a `/success?external_reference=...&status=approved` se vea “Venta exitosa” y, en unos segundos, “Ver mis entradas” o la redirección a `/mis-entradas`.
- Si no aparece el token: el webhook tiene que haber marcado las órdenes como `paid` y creado los tickets; hasta entonces `access-token` puede no devolver token. Comprobar que el webhook de MP esté apuntando a tu dominio (p. ej. `https://www.festivalpucon.cl/api/webhooks/mercadopago`) y que en Vercel estén configurados `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, etc.

**Resumen punto 7:**  
No requiere cambios de código; solo verificar cuando el punto 6 te lleve a `/success`. Si el token no llega, revisar webhook y variables de entorno del webhook.

---

## Punto 8: Página `/mis-entradas` y PDF

**Objetivo:** En `/mis-entradas?token=XXX` se ven las entradas (TicketCards con QR) y el botón “Descargar PDF (todas las entradas)” genera un PDF con QR real.

**Estado del código:**  
Existen y están en uso:

- `GET /api/orders/by-reference?token=...` (datos para la página).
- `GET /api/orders/by-reference/pdf?token=...` (PDF).
- Página `src/app/mis-entradas/page.tsx` con TicketCards y botón de descarga.

**Qué revisar (cuando funcionen 6 y 7):**

- Que la página cargue sin error y muestre las entradas con QR (no placeholder).
- Que el PDF se descargue y cada entrada tenga su QR escaneable.

**Resumen punto 8:**  
Tampoco requiere cambios; solo comprobar el comportamiento cuando ya llegues a `/mis-entradas` desde `/success`.

---

## Orden recomendado

1. **Punto 6:** En la pantalla de MP, hacer clic en “Volver al comercio” / “Continuar” (si existe) y comprobar si llegas a nuestra `/success`. Si no, revisar `NEXT_PUBLIC_BASE_URL` en Vercel para ese entorno.
2. **Punto 7:** Una vez en `/success`, comprobar que aparece “Ver mis entradas” y que redirige a `/mis-entradas?token=...`. Si el token no llega, revisar webhook y env.
3. **Punto 8:** En `/mis-entradas`, comprobar entradas con QR y descarga del PDF.

No se tocan los archivos puente (create-preference entradas/tickets, success) salvo que, tras estas comprobaciones, se decida un cambio mínimo con respaldo previo.
