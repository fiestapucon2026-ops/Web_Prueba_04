# Instrucciones — Prueba final completa E2E

**Estado:** Listos para la prueba final. BASE se obtiene del request (multi-dominio resuelto); referencias MP Chile documentadas; respaldos hechos; build OK.

---

## ¿Falta algo antes de probar?

| Requisito | Dónde comprobarlo | Acción si falta |
|-----------|-------------------|------------------|
| Variables de entorno (webhook, token, email) | Vercel → Settings → Environment Variables (entorno que uses) | Añadir: `MP_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `QR_SIGNING_SECRET`, `RESEND_API_KEY`. `NEXT_PUBLIC_BASE_URL` es opcional (BASE se toma del request). |
| Webhook MP apuntando a tu dominio | Dashboard MP → Tu integración → Webhooks | URL = `https://TU-DOMINIO/api/webhooks/mercadopago` (el mismo dominio donde abras /entradas). |
| Dominio Resend verificado | Resend dashboard | Dominio del remitente (ej. noreply@festivalpucon.cl) verificado para que llegue el email. |
| Rutas /entradas y /success en el deployment | Rama desplegada (ej. main) | Confirmar que existen `src/app/entradas/page.tsx` y `src/app/success/page.tsx`. |
| Inventario en Supabase | Tablas events, ticket_types, inventory | Al menos un evento con inventario disponible (ver GUIA_INSERCION_DATOS.md si aplica). |

Si todo lo anterior está OK, se puede hacer la prueba final.

---

## Instrucciones paso a paso (prueba final)

### 1. Elegir dominio de prueba

- **Opción A (Vercel):** `https://web-prueba-04.vercel.app`  
- **Opción B (producción):** `https://www.festivalpucon.cl`  

No hace falta configurar `NEXT_PUBLIC_BASE_URL` por dominio: la BASE se toma del request (Host). Abre el dominio que vayas a usar.

---

### 2. Desplegar los últimos cambios

Si acabas de aplicar los cambios (BASE desde request, `base-url.ts`):

```bash
git add -A && git status
git commit -m "feat: BASE desde request (multi-dominio) + refs MP Chile"
git push
```

En Vercel, espera a que el deployment termine (Ready). Si usas web-prueba-04, abre la URL del deployment que corresponda a tu rama.

---

### 3. Comprobar que /entradas y /success responden

En el navegador:

- Abre `https://TU-DOMINIO/entradas` → debe cargar la página de entradas (formulario, fechas, etc.).
- Abre `https://TU-DOMINIO/success` → debe cargar la página "Venta exitosa" (aunque no haya query params).

Si alguna da 404, la rama desplegada no tiene esas rutas; corregir deployment o rama antes de seguir.

---

### 4. Webhook en Mercado Pago

En el dashboard de MP (Chile), en tu aplicación:

- Webhooks → URL de notificación = `https://TU-DOMINIO/api/webhooks/mercadopago`  
  (TU-DOMINIO = el mismo que uses en el paso 5, ej. web-prueba-04.vercel.app o www.festivalpucon.cl).

---

### 5. Ejecutar la prueba E2E

1. Abre **https://TU-DOMINIO/entradas** (no localhost si quieres probar redirección y webhook en Vercel).
2. Elige fecha y tipo de entrada, escribe email (ej. el tuyo o uno de prueba), pulsa **Continuar**.
3. Serás redirigido a Mercado Pago. Paga en sandbox:
   - Tarjeta: `5031 4332 1540 6351`
   - Vencimiento: cualquiera futuro | CVV: `123`
   - Titular: `APRO` (aprueba).
4. Tras aprobar:
   - **Punto 6:** MP debe redirigir (o mostrar "Volver al sitio") a **https://TU-DOMINIO/success?external_reference=...&status=approved**.
   - **Punto 7:** En /success debe aparecer "Venta exitosa", cuenta regresiva y enlace "Ver mis entradas" (o redirección automática a /mis-entradas?token=...).
   - **Punto 8:** En /mis-entradas deben verse las TicketCards con QR y el botón "Descargar PDF (todas las entradas)" debe descargar un PDF con QR real.
5. Revisar email: debe llegar **un** correo con asunto "Tu compra — Festival Pucón 2026", enlace "Ver y descargar mis entradas" y, si está implementado, PDF adjunto.

---

### 6. Si algo falla

| Síntoma | Revisar |
|--------|---------|
| No redirige a /success (te quedas en MP) | Que /success responda 200 en TU-DOMINIO (paso 3). Que el deployment sea el último (con BASE desde request). |
| /success no muestra "Ver mis entradas" | Webhook: URL en MP = TU-DOMINIO/api/webhooks/mercadopago; en Vercel: MP_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, QR_SIGNING_SECRET. En Supabase: órdenes con ese external_reference en `paid` y filas en `tickets`. |
| No llega el email | RESEND_API_KEY en Vercel; dominio del remitente verificado en Resend. |
| 502 al pulsar Continuar | Ver logs del deployment en Vercel; no tocar create-preference sin restaurar desde respaldo si fue modificado. Restaurar desde `respaldo_pre_tickets_qr/` si es necesario. |

---

### 7. Restaurar al punto cero (solo si hace falta)

Si la prueba deja algo roto y quieres volver al estado anterior a los cambios de BASE desde request:

```bash
cp respaldo_pre_tickets_qr/tickets_create_preference_route.ts.bak src/app/api/tickets/create-preference/route.ts
cp respaldo_pre_tickets_qr/entradas_create_preference_route_antes_base_dinamico.bak src/app/api/entradas/create-preference/route.ts
```

Luego quitar el import y uso de `getBaseUrlFromRequest` en entradas y volver a `process.env.NEXT_PUBLIC_BASE_URL || '...'` en tickets. Opcional: eliminar `src/lib/base-url.ts` si no se usa en ningún otro sitio.

---

## Resumen

- **Sí estamos listos** para la prueba final: BASE desde request, docs MP Chile, multi-dominio resuelto, build OK, respaldos hechos.
- **Antes de probar:** Env en Vercel (webhook, token, email), URL del webhook en MP, dominio Resend verificado, rutas /entradas y /success en el deployment, inventario en Supabase.
- **Prueba:** Abrir TU-DOMINIO/entradas → Continuar → pagar en MP (APRO) → comprobar redirección a /success → /mis-entradas con QR y PDF → email recibido.
