# Pasos Finales - Configuración Vercel y Mercado Pago

## ✅ Completado Automáticamente

- ✅ Commit realizado
- ✅ Push a GitHub exitoso
- ✅ Branch `feature/mercado-pago-payment` disponible en GitHub
- ✅ Vercel debería detectar automáticamente el nuevo branch

---

## 📋 Pasos Manuales Requeridos

### Paso 1: Esperar Deployment en Vercel (Automático)

1. Ir a: https://vercel.com
2. Seleccionar proyecto `web_oficial_festival`
3. Ir a: **Deployments**
4. Buscar el deployment del branch `feature/mercado-pago-payment`
5. Esperar a que termine el build (puede tardar 2-5 minutos)
6. **Copiar la Preview URL** (ej: `https://feature-mercado-pago-payment-xxx.vercel.app`)

**Si no aparece automáticamente:**
- Vercel puede tardar unos minutos en detectar el nuevo branch
- O puedes hacer click en "Redeploy" si es necesario

---

### Paso 2: Configurar Variables de Entorno en Vercel

1. En Vercel, ir a: **Settings** → **Environment Variables**
2. Agregar cada variable una por una:

#### 2.1 Supabase

**Variable 1:**
```
Name: SUPABASE_URL
Value: <tu-project-url-de-supabase>
Environments: ☑ Production ☑ Preview ☑ Development
```

**Variable 2:**
```
Name: SUPABASE_ANON_KEY
Value: <tu-anon-key-de-supabase>
Environments: ☑ Production ☑ Preview ☑ Development
```

#### 2.2 Mercado Pago

**Variable 3:**
```
Name: MP_ACCESS_TOKEN
Value: <tu-access-token-de-mp>
Environments: ☑ Production ☑ Preview ☑ Development
```

**Variable 3b (obligatoria para que el webhook procese pagos):**
```
Name: MP_WEBHOOK_SECRET
Value: <secret-del-webhook-en-panel-mp>
Environments: ☑ Production ☑ Preview ☑ Development
```
Sin esta variable el webhook responde 503. Se obtiene al configurar la URL del webhook en el panel de Mercado Pago.

#### 2.3 Resend (Opcional - para primera prueba puede omitirse)

**Variable 4:**
```
Name: RESEND_API_KEY
Value: <tu-api-key-de-resend>
Environments: ☑ Production ☑ Preview ☑ Development
```

**Nota:** Si no tienes Resend aún, puedes omitir esta variable. El pago funcionará pero no se enviará email.

#### 2.4 URL Base

**Variable 5 (Production):**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://www.festivalpucon.cl
Environments: ☑ Production (solo)
```

**Variable 6 (Preview) — obligatoria para Preview:**
```
Name: NEXT_PUBLIC_BASE_URL
Value: <la-preview-url-que-copiaste-en-paso-1>
Environments: ☑ Preview (solo)
```
Sin esta variable, las `back_urls` y la `notification_url` del pago apuntan al fallback de producción y el webhook no recibe notificaciones en el deployment Preview.

**Ejemplo:**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://feature-mercado-pago-payment-abc123.vercel.app
Environments: ☑ Preview
```

3. Click en **Save** para cada variable

---

### Paso 3: Redeploy con Variables

1. Después de agregar todas las variables
2. Ir a: **Deployments**
3. Buscar el último deployment del branch `feature/mercado-pago-payment`
4. Click en los **3 puntos** (⋯) → **Redeploy**
5. Esperar a que termine el nuevo build

**Esto es importante:** Las variables de entorno solo se aplican en nuevos deployments.

---

### Paso 4: Verificar que la API Funciona

1. Abrir navegador
2. Ir a: `https://<tu-preview-url>/api/tickets/types`
3. **Deberías ver JSON con:**
   ```json
   {
     "ticket_types": [
       {"id": "...", "name": "General", "price": 10000},
       {"id": "...", "name": "VIP", "price": 25000}
     ],
     "events": [
       {"id": "...", "name": "Festival Pucón 2026", ...}
     ],
     "inventory": [...]
   }
   ```

**Si ves esto → ✅ API funciona correctamente**

**Si ves error:**
- Verificar que las variables de entorno están configuradas
- Verificar que el deployment terminó correctamente
- Revisar logs en Vercel (Deployments → Click en deployment → Logs)

---

### Paso 5: Configurar Webhook en Mercado Pago

1. Ir a: https://www.mercadopago.cl/developers/panel
2. Seleccionar tu aplicación
3. Ir a: **Configuración** → **Webhooks** (o **Notificaciones IPN**)
4. Click en **Agregar URL de webhook** o **Configurar webhooks**
5. URL: `https://<tu-preview-url>/api/webhooks/mercadopago`
   - Ejemplo: `https://feature-mercado-pago-payment-abc123.vercel.app/api/webhooks/mercadopago`
6. Eventos: Seleccionar **payment** (o "Pagos")
7. Guardar

**Nota importante:**
- Para pruebas locales necesitarías ngrok
- Con preview URL de Vercel funciona directamente

---

## ✅ Checklist Final

Antes de hacer la primera prueba:

- [ ] Deployment en Vercel completado
- [ ] Preview URL copiada
- [ ] Variables de entorno configuradas en Vercel:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `MP_ACCESS_TOKEN`
  - [ ] `RESEND_API_KEY` (opcional)
  - [ ] `NEXT_PUBLIC_BASE_URL` (Preview)
- [ ] Redeploy realizado después de agregar variables
- [ ] Endpoint `/api/tickets/types` retorna datos correctos
- [ ] Webhook configurado en Mercado Pago

---

## 🚀 Primera Prueba

Una vez completado el checklist:

1. Ir a: `https://<tu-preview-url>/tickets`
2. Seleccionar evento
3. Seleccionar tipo de ticket
4. Ingresar cantidad y email
5. Click en "Comprar con Mercado Pago"
6. Completar pago en MP (usar tarjeta de prueba si es test)
7. Verificar redirección
8. Verificar que se recibió webhook (revisar logs en Vercel)
9. Verificar que orden se actualizó en Supabase
10. Verificar email (si configuraste Resend)

**Guía completa:** Ver `PLAN_PRUEBAS_MP.md`

---

## 🔍 Troubleshooting

### Error: "Supabase no está configurado"
**Solución:** Verificar variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Vercel

### Error: "MP_ACCESS_TOKEN no está configurado"
**Solución:** Verificar variable `MP_ACCESS_TOKEN` en Vercel

### API retorna 500
**Solución:** 
- Revisar logs en Vercel (Deployments → Logs)
- Verificar que las variables están marcadas para "Preview"
- Verificar que hiciste redeploy después de agregar variables

### Webhook no se recibe
**Solución:**
- Verificar URL del webhook en MP (debe ser la preview URL)
- Verificar que el endpoint existe: `https://<url>/api/webhooks/mercadopago`
- Revisar logs en Vercel para ver si llegó el webhook

---

## 📞 Siguiente Paso

Una vez completados estos pasos, estarás listo para la primera prueba completa con Mercado Pago.

**Si tienes problemas en algún paso, indícalo y te ayudo específicamente.**
