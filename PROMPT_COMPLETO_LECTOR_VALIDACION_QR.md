# Prompt completo: Aplicación de lectura y validación de QR en puerta

**Objetivo:** Construir únicamente la aplicación de lectura de QR (UI) que valide o rechace entradas y, en caso correcto, deje registrado en base de datos el cambio de estado del ticket — **sin modificar ni dañar nada del flujo ya construido (venta, MP, success, mis-entradas, PDF, worker, APIs existentes).**

---

## 1. REGLAS OBLIGATORIAS (NO NEGOCIABLES)

- **No dañar lo construido**
  - No modificar: flujo de venta, create-preference (entradas/tickets), webhook Mercado Pago, success, mis-entradas, generación de PDF, worker process-tickets, RPC atómica, ni ninguna ruta API que no sea la de validación (y solo para extender de forma compatible, ej. añadir protección opcional).
  - No cambiar esquema de tablas `orders`, `tickets`, `inventory`, `job_queue` salvo migración explícita y documentada si fuera estrictamente necesaria para el validador (no se espera que lo sea).
  - Antes de tocar cualquier archivo existente: crear respaldo (ej. en `respaldo_pre_validacion_qr/`).

- **Seguridad**
  - La pantalla de lectura/validación debe ser solo para personal autorizado (portería/admin): ruta protegida con la misma auth que el resto de admin (ej. `/admin/validar-qr`).
  - No exponer en la UI pública un “validador” sin autenticación.
  - Valorar proteger también el endpoint de validación (ver sección 4).

- **Fuente de verdad**
  - El estado del ticket está en la tabla `tickets`. La app de lectura solo debe **llamar a la API existente**; no duplicar lógica de negocio ni escribir directamente en BD desde el cliente.

---

## 2. LO QUE YA EXISTE (NO ROMPER — SOLO CONSUMIR)

### 2.1 Base de datos (Supabase)

- **Tabla `tickets`**
  - Columnas relevantes: `id`, `order_id`, `inventory_id`, `status` (`'sold_unused'` | `'used'`), `qr_uuid` (UUID, UNIQUE), `scanned_at`, `used_at`, `pdf_url`, `scanned_by`. (La API actual no escribe `scanned_by`; la columna existe en esquema pero no forma parte del contrato de validación.)
  - RLS: solo acceso vía `service_role` (APIs con `requireSupabaseAdmin()`).

### 2.2 API de validación (ya implementada)

- **Ruta:** `POST /api/tickets/validate`
- **Archivo:** `src/app/api/tickets/validate/route.ts`
- **Request:** body JSON `{ "qr_uuid": "<uuid>" }` (Zod: `z.string().uuid()`).
- **Comportamiento:**
  1. Busca ticket por `tickets.qr_uuid`.
  2. Si no existe o no es válido → responde `200` con `{ "valid": false, "message": "Entrada no válida" }`.
  3. Si `status === 'used'` o `scanned_at` no es null → `200` con `{ "valid": false, "message": "Entrada ya utilizada" }`.
  4. Si `status !== 'sold_unused'` → `200` con `{ "valid": false, "message": "Entrada no válida" }`.
  5. Si está `sold_unused`: hace **UPDATE** en `tickets` para ese `id`: `status = 'used'`, `scanned_at = now`, `used_at = now`; responde `200` con `{ "valid": true, "message": "Entrada validada", "ticket_id": "<id>" }`.
- **Otros códigos:** `400` si `qr_uuid` inválido; `500` si error interno o fallo en el UPDATE.

Es decir: la API ya **revisa, valida o rechaza** y, en caso correcto, **cambia el estado en la base de datos**. No hay que reimplementar esa lógica.

### 2.3 Contenido del QR en tickets

- En “Mis entradas” y en el PDF, el QR contiene el **`qr_uuid`** del ticket (string UUID) cuando existe.
- La API de validación acepta ese mismo valor (UUID string). La aplicación de lectura solo debe **extraer ese string del QR** y enviarlo en `POST /api/tickets/validate` con `{ qr_uuid }`.
- **Alcance:** solo tickets cuyo QR es el UUID en claro; si el QR contiene un token firmado (fallback cuando no hay `qr_uuid`), esa entrada queda fuera del alcance de esta API.

### 2.4 Auth admin existente

- **Middleware:** `src/middleware.ts` — aplica verificación de auth solo a **`/api/admin/*`** (con `verifyAdminKeyEdge`); las rutas de **página** `/admin/*` no pasan por esa verificación en el middleware.
- **Auth:** `src/lib/admin-auth.ts` (clave en `x-admin-key` o cookie de sesión vs `ADMIN_SECRET`).
- **Protección de páginas admin:** cada página bajo `/admin/*` se protege en la propia página: llamada a un endpoint bajo `/api/admin/*` con `credentials: 'include'`; si 401, mostrar formulario de login (patrón en `src/app/admin/stock/page.tsx`). La nueva pantalla debe seguir el mismo patrón y vivir bajo `/admin/` (ej. `/admin/validar-qr`).

---

## 3. LO QUE FALTA (A CONSTRUIR)

Solo la **aplicación de lectura/validación (UI)**:

1. **Pantalla bajo admin** (ej. `/admin/validar-qr`)
   - Protegida por la misma autenticación que el resto del admin (el usuario debe estar logueado como admin para verla).
   - Capacidades:
     - **Leer el QR** del ticket: por cámara del dispositivo o por subida de imagen.
     - Extraer del QR el valor (string que debe ser un UUID = `qr_uuid`).
     - Enviar `POST /api/tickets/validate` con body `{ "qr_uuid": "<valor extraído>" }`.
     - Mostrar el resultado de forma clara:
       - **Válida:** mensaje tipo “Entrada validada” (ej. estilo verde).
       - **Rechazada:** mensajes “Entrada ya utilizada”, “Entrada no válida”, “qr_uuid inválido”, etc. (ej. estilo rojo).
   - No alterar el contrato de la API ni las respuestas ya definidas; solo consumirlas y mostrarlas.

2. **Protección del endpoint (recomendado, opcional en v1)**  
   - Hoy `POST /api/tickets/validate` no está bajo `/api/admin`, por tanto es abierto. Opciones sin romper el contrato:
     - Opción A: La UI **no** debe enviar un secret desde el navegador (no exponer secret en cliente). Crear un proxy bajo `POST /api/admin/tickets/validate` que verifique auth admin (cookie/header existente) y ejecute la lógica de validación (o llame internamente a la misma). Así el endpoint público `/api/tickets/validate` puede quedar deshabilitado o restringido por IP si se desea.
     - Opción B: Mover la lógica a un módulo compartido y que tanto `/api/tickets/validate` como `/api/admin/tickets/validate` la usen; la ruta bajo `/api/admin/*` queda protegida por el middleware existente.
   - Documentar la decisión.

3. **Opcional (no bloqueante)**  
   - Registrar en tabla de auditoría (si existe) un evento tipo “ticket_validated” con `ticket_id`, timestamp, origen. No obligatorio para el primer entregable.

---

## 4. CHECKLIST DE NO-REGRESIÓN (NO TOCAR SALVO LO INDICADO)

Al implementar, **no modificar**:

- `src/app/api/entradas/**`
- `src/app/api/orders/**` (access-token, by-reference, by-reference/pdf, [id])
- `src/app/api/tickets/create-preference/**`, `generate-pdf/**`, `types/**`
- `src/app/api/webhooks/mercadopago/**`
- `src/app/api/workers/process-tickets/**`
- `src/app/success/**`, `src/app/mis-entradas/**`
- Flujo de páginas públicas de entradas/checkout.
- `src/lib/pdf.tsx`, `src/lib/mercadopago.ts`, `src/lib/supabase.ts`
- Migraciones existentes de Supabase (orders, tickets, inventory, job_queue, RLS, RPC atómica, audit_log).
- Middleware: solo añadir rutas si se crean nuevas bajo `/admin`; no cambiar la protección de `/api/admin` ni del flujo público. No exigir auth en el middleware para rutas `/admin/*` (mantener el patrón actual: protección por página vía fetch a `/api/admin/*`).

Se **puede** tocar:

- Crear nueva ruta de página: `src/app/admin/validar-qr/` (o nombre equivalente).
- Crear componentes solo para esa pantalla (lector QR, resultado).
- Opcional: `src/app/api/tickets/validate/route.ts` solo para añadir comprobación de header/secret o delegar a módulo compartido; sin cambiar el contrato request/response ni la lógica de UPDATE.
- Opcional: nueva ruta `src/app/api/admin/tickets/validate` que verifique auth admin y llame a la misma lógica.

---

## 5. DETALLES TÉCNICOS ÚTILES

- **Stack:** Next.js 14+, TypeScript (strict), Tailwind, Vercel, Supabase.
- **Lectura de QR en el cliente:** usar una librería que permita leer desde cámara y/o desde imagen (ej. `react-qr-reader`, `@zxing/browser`, u otra que devuelva el string del QR). El contenido esperado es el UUID del ticket (`tickets.qr_uuid`).
- **Llamada a la API:** desde la UI (admin), `fetch('/api/tickets/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr_uuid: valorExtraido }) })`. Si se implementa protección por header, añadir el header acordado.

---

## 6. ENTREGABLES ESPERADOS

1. Ruta protegida (ej. `/admin/validar-qr`) con pantalla que: lea QR (cámara o imagen) → envíe `POST /api/tickets/validate` con `{ qr_uuid }` → muestre resultado válida/rechazada.
2. Respaldos de todos los archivos que se modifiquen (en carpeta tipo `respaldo_pre_validacion_qr/`).
3. Si se añade protección al endpoint (header/secret o ruta bajo `/api/admin`): documentación breve (qué header o ruta, dónde configurar el secret si aplica).
4. Ningún cambio que rompa: compra, create-preference, success, mis-entradas, PDF, worker ni el resto de APIs existentes.

---

## 7. RESUMEN PARA EL ASISTENTE

- **Objetivo:** Solo la app de lectura de QR en puerta (UI bajo admin) que valide o rechace y, en caso correcto, deje el ticket actualizado en BD **usando la API existente**.
- **Restricción:** No dañar el flujo actual (venta, MP, tickets, PDF, worker). Respaldar antes de modificar. Respetar el checklist de no-regresión.
- **Ya existe:** Tabla `tickets` con `qr_uuid`, `status`, `scanned_at`, `used_at`; `POST /api/tickets/validate` que ya hace la validación y el UPDATE en base de datos.
- **Falta:** UI de escaneo (cámara o imagen) protegida por auth admin, que llame a la API y muestre el resultado; y opcionalmente asegurar el endpoint de validación (auth/header o ruta admin).
