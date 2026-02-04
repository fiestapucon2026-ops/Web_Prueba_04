# Prompt: Módulo de lectura y validación de QR en puerta

**Objetivo:** Tener una aplicación (pantalla) que lea el QR del ticket, valide o rechace, y en caso correcto actualice el estado del ticket en la base de datos — **sin dañar nada de lo ya construido.**

---

## REGLAS OBLIGATORIAS (NO NEGOCIABLES)

1. **No dañar lo construido**
   - No modificar el flujo de venta: entradas → create-preference → Mercado Pago → success → Mis entradas → PDF/tickets.
   - No tocar rutas API existentes salvo para extenderlas de forma compatible (ej. opcional auth en `/api/tickets/validate`).
   - No cambiar esquema de tablas `orders`, `tickets` (salvo migración explícita y documentada si es estrictamente necesaria para el validador).
   - Respaldar todo archivo que se vaya a modificar antes de editarlo (ej. en `respaldo_pre_validacion_qr/`).

2. **Seguridad**
   - El endpoint de validación debe ser accesible solo por personal autorizado (portería/admin). Definir cómo: ruta protegida (ej. `/admin/validar-qr` con auth existente de admin), o header/API key solo para ese uso.
   - No exponer en la UI pública un “validador” sin autenticación.

3. **Fuente de verdad**
   - El estado del ticket está en la tabla `tickets`: columnas `status` ('sold_unused' | 'used'), `scanned_at`, `used_at`, `qr_uuid`. La aplicación de lectura solo debe **consultar y actualizar** vía la API existente; no duplicar lógica de negocio en el cliente.

---

## LO QUE YA EXISTE (NO ROMPER)

- **Tabla `tickets`** (Supabase): `id`, `order_id`, `inventory_id`, `status` ('sold_unused' | 'used'), `qr_uuid` (UUID UNIQUE), `scanned_at`, `used_at`, `pdf_url`, `scanned_by`. RLS: solo `service_role`.
- **API de validación:** `POST /api/tickets/validate`  
  - Body: `{ "qr_uuid": "<uuid>" }` (Zod: `z.string().uuid()`).  
  - Comportamiento: busca ticket por `qr_uuid`; si no existe o no es válido → `{ valid: false, message: "Entrada no válida" }` o `"Entrada ya utilizada"`; si está `sold_unused` → UPDATE `status = 'used'`, `scanned_at` y `used_at` = now(), respuesta `{ valid: true, message: "Entrada validada", ticket_id }`.  
  - Archivo: `src/app/api/tickets/validate/route.ts`.
- **Contenido del QR mostrado al usuario:** En Mis entradas y en el PDF, el QR contiene el **`qr_uuid`** del ticket (UUID) cuando existe; si no, se usa un token firmado (`signTicket`). Para validación en puerta se asume que el QR impuesto/escaneará es el **qr_uuid** (UUID string), que es lo que acepta hoy la API.
- **Flujo de venta y tickets:** 100% operativo (create-preference, MP, success, mis-entradas, PDF, worker, RPC atómica, precio por día). No tocar.

---

## LO QUE FALTA (A CONSTRUIR)

1. **Aplicación de lectura/validación (UI)**  
   - Una pantalla destinada a **portería/personal en puerta** que:
     - Esté protegida por autenticación (ej. misma auth que `/admin/stock` o ruta bajo `/admin/validar-qr`).
     - Permita **leer el QR** del ticket (cámara del dispositivo o subida de imagen).
     - Extraiga del QR el valor (string `qr_uuid`, UUID).
     - Envíe `POST /api/tickets/validate` con `{ qr_uuid }`.
     - Muestre claramente el resultado: **Válida** (verde / “Entrada validada”) o **Rechazada** (rojo / “Entrada ya utilizada”, “Entrada no válida”, etc.), sin alterar el flujo ni las respuestas ya definidas en la API.

2. **Protección del endpoint de validación (recomendado)**  
   - Hoy `POST /api/tickets/validate` es abierto. Valorar: exigir header (ej. `Authorization: Bearer <VALIDADOR_SECRET>`) o que solo sea invocable desde rutas ya protegidas (middleware admin). Documentar la decisión.

3. **Opcional**  
   - Registro de escaneos (auditoría): si ya existe tabla de auditoría, considerar registrar evento “ticket_validated” con `ticket_id`, timestamp, origen (opcional). No obligatorio para el primer entregable.

---

## DETALLES TÉCNICOS ÚTILES

- **Proyecto:** Next.js 14+, TypeScript, Tailwind, Vercel, Supabase.  
- **Auth admin:** Ver `src/lib/admin-auth.ts`, `admin-auth-edge.ts`, middleware en `src/middleware.ts` (rutas `/admin/*`, `/api/admin/*`).  
- **Validación actual:** `src/app/api/tickets/validate/route.ts` (Supabase `requireSupabaseAdmin()`, UPDATE en `tickets` por `id` del ticket encontrado por `qr_uuid`).  
- **QR en cliente:** Se puede usar una librería para leer QR desde cámara o imagen (ej. `react-qr-reader`, `@zxing/browser`, u otra que devuelva el string del QR). El contenido esperado es el UUID del ticket (`tickets.qr_uuid`).

---

## ENTREGABLES ESPERADOS

1. Ruta protegida (ej. `/admin/validar-qr`) con pantalla que: lea QR (cámara o imagen) → envíe `POST /api/tickets/validate` con `{ qr_uuid }` → muestre resultado válida/rechazada.  
2. Respaldos de todos los archivos tocados.  
3. Si se añade protección al endpoint (header/secret o middleware): documentación breve (qué header o ruta, dónde configurar el secret si aplica).  
4. Ningún cambio que rompa: compra, create-preference, success, mis-entradas, PDF, worker, ni el resto de APIs existentes.

---

## RESUMEN PARA EL ASISTENTE

- **Objetivo:** App de lectura de QR en puerta que valide o rechace y actualice el ticket en BD usando la API existente.  
- **Restricción:** No dañar el flujo actual (venta, MP, tickets, PDF). Respaldar antes de modificar.  
- **Ya existe:** Tabla `tickets` con `qr_uuid`, `status`, `scanned_at`; `POST /api/tickets/validate` con lógica validar/rechazar y UPDATE.  
- **Falta:** UI de escaneo (cámara o imagen) protegida por auth admin, que llame a la API y muestre el resultado; y opcionalmente asegurar el endpoint de validación (auth/header).
