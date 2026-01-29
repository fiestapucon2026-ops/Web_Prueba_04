# Informe de Auditoría — Integración Checkout Pro (Mercado Pago)

**Proyecto:** web_oficial_festival  
**Rama:** feature/mercado-pago-payment  
**Entorno:** Sandbox / pruebas (TEST).  
**Fecha del informe:** Consolidado con todas las correcciones identificadas.

---

## 1. Contexto de entorno (SANDBOX)

### 1.1 ACCESS_TOKEN — Prefijo TEST-

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | No existe validación del prefijo de `MP_ACCESS_TOKEN`. Se usa `process.env.MP_ACCESS_TOKEN` en `src/lib/mercadopago.ts` sin comprobar si es `TEST-` o `APP_USR-`. | **Verificación manual obligatoria:** En Vercel (y en `.env.local` en local) confirmar que `MP_ACCESS_TOKEN` comienza por `TEST-`. Si comienza por `APP_USR-` está en producción y debe corregirse. **Opcional:** Añadir en runtime (p. ej. en `src/lib/mercadopago.ts` o al crear preferencia) una comprobación que, si el token no empieza por `TEST-` ni por `APP_USR-`, registre un warning en log. |

### 1.2 URL de redirección — init_point vs sandbox_init_point

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | Se usa únicamente `created.init_point` (`src/app/api/tickets/create-preference/route.ts` líneas 179-182). La API de Mercado Pago devuelve también `sandbox_init_point` cuando aplica (SDK: `node_modules/mercadopago/dist/clients/preference/commonTypes.d.ts`: `init_point`, `sandbox_init_point`). | **Corrección prioritaria:** Tras `preferenceClient.create(...)`, elegir la URL así: si `process.env.MP_ACCESS_TOKEN?.startsWith('TEST-')` y `created.sandbox_init_point` es un string no vacío, usar `created.sandbox_init_point`; en caso contrario usar `created.init_point`. Validar que la variable resultante sea string no vacío antes de asignar a `initPoint`. Guardar y devolver ese mismo valor (idempotency y respuesta JSON). El frontend (`src/app/tickets/page.tsx`) sigue usando el campo devuelto (p. ej. `init_point`) sin cambios. |

**Riesgo si no se corrige:** Con credenciales TEST, redirigir a `init_point` puede enviar al usuario al checkout de producción y provocar errores de autorización o “Una de las partes es de prueba”.

---

## 2. Objeto preference (Chile)

### 2.1 currency_id

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | Se fuerza `currency_id: 'CLP'` en el body de la preferencia (`create-preference/route.ts` línea 165). | Ninguna. Correcto. |

### 2.2 unit_price (tipo y redondeo)

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | Se envía `unit_price: unitPrice` donde `unitPrice = Number(ticketType.price)` (líneas 126, 164). Es un *number*; puede ser decimal si la BD tiene decimales. | **Recomendación:** Para CLP evitar decimales. Al construir el item, usar `unit_price: Math.round(unitPrice)` (o `Math.floor` si la lógica de negocio lo exige). Asegurar que el valor sea `>= 0` y finito antes de enviar. |

### 2.3 Payer email (anti-loop en Sandbox)

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | El email viene del body validado (`payer_email`) y se envía en `payer: { email: payer_email }`. No hay comprobación de que sea distinto al email del vendedor. | **Procedimental:** En sandbox el comprador debe usar un email de prueba distinto al del vendedor. El frontend ya ofrece el botón “Usar email de prueba MP” (`TESTUSER5544200525823207849@testuser.com`) en `src/app/tickets/page.tsx`. No se requiere cambio de código; documentar en guías de prueba. |

### 2.4 external_reference

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | Se genera `externalReference = randomUUID()` (línea 136), se envía en la preferencia como `external_reference: externalReference` (176) y se guarda en la orden en `orders.external_reference` (196). El webhook (`src/app/api/webhooks/mercadopago/route.ts`) localiza la orden con `.eq('external_reference', payment.external_reference)` (152-156). | Ninguna. Correcto para conciliación pago ↔ orden. |

### 2.5 Back URLs

| Aspecto | Estado actual | Corrección |
|--------|----------------|------------|
| **Código** | `baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl'` (línea 141). Las rutas success, failure y pending usan `${baseUrl}/success`, etc. | **Configuración:** En entorno de pruebas (local o Preview) definir `NEXT_PUBLIC_BASE_URL` con la URL del deployment o `http://localhost:3000`. Tras cambiar variables en Vercel, hacer Redeploy. No hardcodear localhost en código; mantener un solo fallback de producción. |

---

## 3. Reporte de ejecución

| Aspecto | Contenido |
|--------|------------|
| **Etapa** | Integración implementada; objetivo pendiente documentado: cerrar la primera compra de prueba exitosa (orden `paid`, redirección a `/success`). |
| **Errores documentados** | “Una de las partes es de prueba” cuando se mezcla cuenta/tarjeta de producción con credenciales TEST o viceversa. Mitigación: cuenta de prueba MP + tarjeta de prueba + email de prueba. |
| **Soluciones aplicadas (doc)** | Uso de cuenta de prueba, tarjeta de prueba (titular APRO) y email de prueba. En código: corrección de uso de `sandbox_init_point` pendiente de implementar según este informe. |

---

## 4. Test data (factor humano)

| Aspecto | Contenido |
|--------|------------|
| **Tarjetas** | En sandbox deben usarse únicamente las **tarjetas de prueba** de Mercado Pago (documentación de pruebas MP), no tarjetas reales chilenas. Ejemplo documentado: Mastercard 5416 7526 0258 2580, CVV 123, venc. 11/30, titular **APRO** para pago aprobado. |
| **Email** | El frontend incluye el botón “Usar email de prueba MP” que rellena un email de prueba; usar ese u otro usuario de prueba de MP. |

---

## 5. Resumen de correcciones a aplicar

| Prioridad | Ubicación | Acción |
|-----------|-----------|--------|
| **Alta** | `src/app/api/tickets/create-preference/route.ts` | Usar `sandbox_init_point` cuando el token empiece por `TEST-` y exista; en caso contrario `init_point`. Validar string no vacío; guardar y devolver esa URL. |
| **Media** | `src/app/api/tickets/create-preference/route.ts` | Enviar `unit_price` como entero para CLP (p. ej. `Math.round(unitPrice)`). |
| **Baja/Opcional** | `src/lib/mercadopago.ts` o create-preference | Validación en runtime del prefijo de `MP_ACCESS_TOKEN` (`TEST-` / `APP_USR-`) y log de advertencia si no coincide con el entorno esperado. |
| **Config** | Vercel / .env.local | Verificar `MP_ACCESS_TOKEN` con prefijo `TEST-` en pruebas. Definir `NEXT_PUBLIC_BASE_URL` para el entorno que se prueba; Redeploy tras cambios. |

---

## 6. Archivos involucrados

- **API:** `src/app/api/tickets/create-preference/route.ts`, `src/app/api/webhooks/mercadopago/route.ts`, `src/app/api/tickets/types/route.ts`
- **Frontend:** `src/app/tickets/page.tsx`
- **Lib:** `src/lib/mercadopago.ts`, `src/lib/schemas.ts`
- **Documentación:** `.env.example`, `TRASPASO_CURSOR_SIGUIENTE_CHAT.md`, `EJECUTAR_OPCION_A.md`

---

## 7. Certificación

- **CIT (auditoría previa):** 94. Justificación: afirmaciones ligadas a archivo/línea o tipos del SDK; única suposición externa (respuesta de la API con `sandbox_init_point`) respaldada por referencia de la API y tipos del SDK.
- **Estado del informe:** Consolidado; incluye estado actual y todas las correcciones identificadas para evitar errores y confusiones.
