# Informe técnico para experto: Control de acceso por QR — implementación, errores y punto muerto

**Destinatario:** Experto en sistemas de validación / lectura QR / control de acceso.  
**Objetivo:** Documentar al 100% lo implementado, los fallos observados y el punto muerto, para recibir recomendaciones de alternativas de solución.  
**Proyecto:** web_oficial_festival (Next.js 14+, Vercel, Supabase, Mercado Pago).  
**Fecha:** 2026-02-05.

---

## 1. Resumen ejecutivo

- **Compras y emisión de entradas:** Operativas (incl. otros teléfonos).
- **Control de acceso en puerta:** La validación **backend** (API + BD) funciona. La **lectura del QR con cámara** en la pantalla de administración **no es viable en la práctica** (“imposible leer el QR”). La alternativa de **validar por código manual** (pegar UUID) funciona pero no es operativa para flujo en puerta.
- **Punto muerto:** No hay lectura fiable del QR por cámara; se requiere recomendación de alternativas (software, hardware o flujo).

---

## 2. Arquitectura implementada

### 2.1 Modelo de datos (Supabase)

- **Tabla `tickets`**
  - `id` (PK), `order_id`, `inventory_id`, `status` (`sold_unused` | `used`), `qr_uuid` (UUID, UNIQUE, `gen_random_uuid()`), `scanned_at`, `used_at`, `pdf_url`.
  - RLS: acceso solo vía `service_role` (APIs con cliente admin).

- **Origen de `qr_uuid`:** El worker `GET /api/workers/process-tickets` (protegido por `CRON_SECRET`) procesa órdenes pagadas, genera PDF y envía email. Los registros en `tickets` ya vienen con `qr_uuid` desde la migración (default `gen_random_uuid()`). El PDF y la UI “Mis entradas” exponen ese valor como contenido del QR (y como texto copiable).

### 2.2 Contenido del QR

- **En PDF y en la app (Mis entradas / TicketCard):** El QR codifica un **string** que se obtiene así:
  - Si `ticket.qr_uuid` existe y no es vacío → contenido = **UUID en claro** (ej. `2a33410f-b165-4afa-a358-9fa095cdcadb`).
  - Si no → contenido = **token firmado** (Base64URL de `payload.signature_hex`, payload = `uuid|type|issued_at` con HMAC-SHA256; ver `src/lib/security/qr-signer.ts`).
- **API de validación:** Solo acepta **UUID** (Zod `z.string().uuid()`). Cualquier QR que contenga el token firmado **no es válido** para el validador actual (mensaje 400 “qr_uuid inválido”). En la práctica, los tickets generados por el worker tienen `qr_uuid` y el QR es UUID.

### 2.3 API de validación

- **Endpoint usado por la UI admin:** `POST /api/admin/tickets/validate`
  - Protegido por middleware: solo requests que pasan `verifyAdminKeyEdge` (cookie/header de sesión admin).
  - Body: `{ "qr_uuid": "<uuid>" }`.
  - Lógica (módulo compartido `src/lib/tickets/validate.ts`):
    1. `SELECT` en `tickets` por `qr_uuid` (`.single()`).
    2. Si no existe o error → `{ "valid": false, "message": "Entrada no válida" }`.
    3. Si `status === 'used'` o `scanned_at` no null → `{ "valid": false, "message": "Entrada ya utilizada" }`.
    4. Si `status !== 'sold_unused'` → `{ "valid": false, "message": "Entrada no válida" }`.
    5. Si `sold_unused`: `UPDATE` en `tickets` (`status = 'used'`, `scanned_at`, `used_at` = now); respuesta `{ "valid": true, "message": "Entrada validada", "ticket_id": "<id>" }`.
  - Códigos: 400 (body inválido), 401 (no autorizado), 200 (siempre JSON con `valid` true/false), 500 (error interno o fallo en UPDATE).

- Existe también `POST /api/tickets/validate` (misma lógica, sin protección admin); la UI admin no lo usa.

### 2.4 UI de validación (pantalla admin)

- **Ruta:** `/admin/validar-qr`
- **URL producción:** https://www.festivalpucon.cl/admin/validar-qr
- **Protección:** La página no está protegida por middleware; comprueba sesión con `GET /api/admin/inventory` (credentials include). Si 401 → formulario de login con clave admin.
- **Stack de lectura QR:** librería **html5-qrcode** v2.3.8, import dinámico en cliente.
- **Flujo:**
  1. Tras login, se monta un `<div id="admin-qr-reader">` y se instancia `Html5Qrcode(QR_READER_ID, { verbose: false })`.
  2. `html5Qr.start(/* camera */, /* config */, onSuccess, onError)`:
     - **Solicitud de cámara:** `{ facingMode: 'environment' }` (sin restricciones de resolución ni aspect ratio).
     - **Opciones de escaneo:** `{ fps: 6, qrbox: { width: 250, height: 250 } }`.
     - **onSuccess:** recibe `decodedText`; se llama a `POST /api/admin/tickets/validate` con `{ qr_uuid: decodedText.trim() }`; se muestra resultado (válida / rechazada). Se detiene el escáner tras el primer decode.
     - **onError:** callback vacío (se ignora el fallo por frame sin QR).
  3. Si `start()` lanza (p. ej. permisos denegados), se captura y se muestra mensaje genérico: “No se pudo iniciar la cámara. Revisa los permisos del navegador.” y se muestra el bloque de **validación manual**: input de texto + botón “Validar código” (mismo `POST` con el texto pegado; validación de formato UUID con regex antes de enviar).
  4. “Escanear otra entrada” resetea estado y el `useEffect` vuelve a iniciar el escáner (misma configuración).

- **No implementado:** subida de imagen (archivo) para decodificar QR; sin opción de cambiar cámara frontal/trasera desde UI; sin ajuste de resolución ni aspect ratio del stream.

### 2.5 Dependencias relevantes

- `html5-qrcode`: ^2.3.8
- `qrcode`: ^1.5.4 (generación de QR en PDF y en TicketCard)
- En `package.json` existe también `qr-scanner`: ^1.4.2 (no usado en la pantalla de validación).

---

## 3. Errores y comportamiento observado

### 3.1 Síntoma reportado

- **“Imposible leer el QR”:** En uso real (control de acceso en puerta), el escáner de cámara **no llega a decodificar** el QR de forma fiable (o no lo hace en absoluto). No se ha especificado si el fallo es: solo en móvil, solo en impreso, solo en pantalla del asistente, o en todos.

### 3.2 Lo que sí funciona

- **Validación por código manual:** Pegar el UUID en el input y pulsar “Validar código” devuelve correctamente válida/rechazada y actualiza el ticket. Esto confirma que la API, la BD, el formato UUID y el flujo de negocio son correctos.
- **Compras desde otros teléfonos:** OK; el problema está acotado al **lector QR en la UI de validación**.

### 3.3 Posibles causas técnicas (sin haber podido reproducir con logs)

1. **Librería / decode:** html5-qrcode en móviles tiene reportes de problemas (p. ej. issues en GitHub; en 2.3.4 había bugs en modo cámara). Con 2.3.8 no se ha hecho prueba sistemática de dispositivos/navegadores.
2. **Restricciones de cámara:** Solo `facingMode: 'environment'`. Sin pedir resolución mínima ni aspect ratio; en algunos dispositivos el stream puede ser pobre para decode.
3. **Cuadro de escaneo (qrbox):** 250×250 px fijos. En pantallas pequeñas o con densidad alta puede quedar desproporcionado o no alinear bien con el área útil.
4. **Origen del QR:** Si el QR se muestra en **pantalla de otro móvil** (entrada digital): brillo, reflejos, tamaño en px, compresión del navegador pueden degradar el código. Si es **impreso**: tamaño físico, enfoque, iluminación.
5. **Permisos:** Si la cámara no se inicia, se muestra el mensaje genérico y el bloque manual; no hay logging de la excepción en producción.
6. **CSP:** `img-src` incluye `data: blob:`; no debería bloquear el stream de cámara. No se ha verificado si hay restricciones que afecten a `getUserMedia` o al canvas interno de la librería.

### 3.4 No disponible en el informe

- Logs de consola (navegador) o de red en el momento del fallo.
- Dispositivo/navegador exactos (marca, modelo, OS, versión del browser).
- Si el QR mostrado en la entrada es siempre UUID o en algún flujo es token firmado (en ese caso el validador rechazaría por formato).

---

## 4. Punto muerto

- **Objetivo:** En puerta, leer el QR con la cámara del dispositivo del validador y obtener respuesta inmediata (válida/rechazada).
- **Estado:** La lectura por cámara **no es operativamente viable** con la implementación actual. La única vía fiable hoy es **validación manual** (pegar UUID), inadecuada para colas.
- **Limitación:** No se ha podido aislar la causa raíz (librería, constraints, dispositivo, tipo de soporte del QR) por falta de telemetría y de pruebas sistemáticas en el entorno real.

---

## 5. Solicitud de alternativas

Se solicita recomendación de alternativas en uno o varios de estos ejes:

1. **Software (mismo stack):**
   - Sustitución de **html5-qrcode** por otra librería (p. ej. **qr-scanner**, ya en dependencias) o configuración distinta (resolución, aspect ratio, qrbox adaptativo).
   - Añadir **validación por imagen** (subir foto del QR y decodificar en cliente o en servidor) como complemento o fallback.
   - Cambios en constraints de `getUserMedia` o en el flujo de inicio de cámara para mejorar compatibilidad móvil.

2. **Hardware / dispositivo:**
   - Uso de **lectores externos** (USB/Bluetooth) que simulen teclado o envíen el código a la misma página.
   - Dispositivos o apps nativas recomendadas para “solo escanear” y pasar el UUID a la web (deep link, clipboard, etc.).

3. **Flujo / producto:**
   - Mantener QR pero **reducir dependencia del escáner en puerta** (p. ej. código corto alfanumérico visible + QR; validación por código en tablet con teclado).
   - Consideración de **NFC** u otro canal como complemento o sustitución parcial del QR para entradas.

4. **Diagnóstico:**
   - Qué datos convendría recoger (navegador, OS, errores de consola, éxito/fallo por tipo de QR) para poder priorizar una alternativa con datos.

---

## 6. Referencias de código (rutas y archivos)

| Componente | Ruta / archivo |
|------------|----------------|
| UI validación QR | `src/app/admin/validar-qr/page.tsx` |
| API validación (admin) | `src/app/api/admin/tickets/validate/route.ts` |
| Lógica de validación | `src/lib/tickets/validate.ts` |
| Firma QR (token alternativo) | `src/lib/security/qr-signer.ts` |
| Respuesta con qr_token (UUID o firmado) | `src/app/api/orders/by-reference/route.ts`, `src/app/api/orders/[id]/route.ts` |
| Generación PDF (contenido QR) | `src/lib/pdf.tsx` |
| Worker que procesa tickets | `src/app/api/workers/process-tickets/route.ts` |
| Middleware (auth admin en `/api/admin/*`) | `src/middleware.ts` |
| Migración `qr_uuid` | `supabase/migrations/job_queue_and_tickets_storage.sql` (y variante `_sin_drop`) |

---

## 7. Variables de entorno implicadas

- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (APIs y worker).
- **Admin:** `ADMIN_SECRET` (o equivalente para `verifyAdminKeyEdge`).
- **QR firmado (fallback):** `QR_SIGNING_SECRET` (solo si se usara validación por token firmado en el futuro; hoy el validador solo usa UUID).

---

*Fin del informe.*
