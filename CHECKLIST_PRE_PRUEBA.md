# Checklist Pre-Prueba - Mercado Pago

## ✅ Paso 1: Verificación de Datos y Esquema en Supabase

### 1.1 Esquema requerido (tabla orders e idempotencia)

Verificar que la tabla `orders` tenga la columna `mp_payment_id` y que exista la tabla `idempotency_keys` (ver `GUIA_INSERCION_DATOS.md`):

```sql
-- Debe devolver una columna: mp_payment_id
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'mp_payment_id';

-- Debe existir la tabla idempotency_keys
SELECT 1 FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'idempotency_keys';
```

Si falta `mp_payment_id` o la tabla `idempotency_keys`, ejecutar el SQL del Paso 2 en `GUIA_INSERCION_DATOS.md` (incluye ambas).

### 1.2 Datos de prueba

```sql
-- Verificación rápida
SELECT 
    e.name as evento,
    tt.name as tipo_ticket,
    tt.price as precio,
    inv.total_capacity as capacidad,
    inv.total_capacity - COUNT(o.id) FILTER (WHERE o.status IN ('pending', 'paid')) as disponibles
FROM public.events e
JOIN public.inventory inv ON inv.event_id = e.id
JOIN public.ticket_types tt ON tt.id = inv.ticket_type_id
LEFT JOIN public.orders o ON o.inventory_id = inv.id
GROUP BY e.id, e.name, tt.id, tt.name, tt.price, inv.id, inv.total_capacity;
```

**Resultado esperado:**
```
evento              | tipo_ticket | precio | capacidad | disponibles
--------------------|-------------|--------|-----------|------------
Festival Pucón 2026 | General     | 10000  | 100       | 100
Festival Pucón 2026 | VIP         | 25000  | 50        | 50
```

**Si ves esto → ✅ Datos correctos**

---

## ✅ Paso 2: Credenciales Necesarias

### 2.1 Supabase (Ya deberías tenerlas)

- [ ] `SUPABASE_URL` - Project URL de Supabase
- [ ] `SUPABASE_ANON_KEY` - anon public key

**Dónde obtenerlas:**
1. Supabase Dashboard → Settings (⚙️) → API
2. Copiar "Project URL" y "anon public" key

---

### 2.2 Mercado Pago

- [ ] `MP_ACCESS_TOKEN` - Access Token de MP

**Dónde obtenerlo:**
1. Ir a: https://www.mercadopago.cl/developers/panel
2. Seleccionar tu aplicación (o crear una nueva)
3. Ir a: **Credenciales**
4. Copiar **Access Token** (Test o Production)

**Para primera prueba, recomiendo usar Test:**
- Access Token de Test (empieza con `TEST-`)
- Tarjetas de prueba disponibles
- No afecta producción

---

### 2.3 Resend (Email - Opcional para primera prueba)

- [ ] `RESEND_API_KEY` - API Key de Resend

**Dónde obtenerlo:**
1. Ir a: https://resend.com/api-keys
2. Crear API Key
3. Copiar el key

**Nota:** Si no tienes esto aún, puedes probar el flujo de pago sin email. El PDF se generará pero no se enviará.

---

### 2.4 URL Base (obligatoria para back_urls y webhook)

- [ ] `NEXT_PUBLIC_BASE_URL` - URL del deployment

**Importante:** Sin esta variable, `back_urls` y `notification_url` usan el fallback de producción. En Preview **debe** configurarse con la Preview URL para que el webhook y las páginas success/failure/pending apunten al mismo deployment.

**Para Preview de Vercel:**
- Formato: `https://feature-mercado-pago-payment-xxx.vercel.app`
- Copiar de Deployments → Preview del branch

**Para Local:** `http://localhost:3000`

### 2.5 Webhook (producción)

- [ ] `MP_WEBHOOK_SECRET` - Secret para verificar firma del webhook

**Obligatorio en producción.** Sin él, el webhook responde 503 y no procesa pagos. Obtenerlo en el panel de Mercado Pago al configurar la URL del webhook.

---

## ✅ Paso 3: Configuración en Vercel

### 3.1 Push del Branch a GitHub

**Si aún no has hecho push:**

```bash
# Verificar que estás en el branch correcto
git branch

# Deberías ver: * feature/mercado-pago-payment

# Agregar todos los cambios
git add .

# Commit
git commit -m "feat: integración completa Mercado Pago con Supabase"

# Push (si es la primera vez)
git push -u origin feature/mercado-pago-payment

# O si ya existe
git push
```

---

### 3.2 Configurar Variables de Entorno en Vercel

1. Ir a: https://vercel.com
2. Seleccionar proyecto `web_oficial_festival`
3. Ir a: **Settings** → **Environment Variables**
4. Agregar cada variable:

**Supabase:**
```
Name: SUPABASE_URL
Value: <tu-project-url-de-supabase>
Environments: ☑ Production ☑ Preview ☑ Development
```

```
Name: SUPABASE_ANON_KEY
Value: <tu-anon-key-de-supabase>
Environments: ☑ Production ☑ Preview ☑ Development
```

**Mercado Pago:**
```
Name: MP_ACCESS_TOKEN
Value: <tu-access-token-de-mp>
Environments: ☑ Production ☑ Preview ☑ Development
```

**Resend (Opcional):**
```
Name: RESEND_API_KEY
Value: <tu-api-key-de-resend>
Environments: ☑ Production ☑ Preview ☑ Development
```

**URL Base:**
```
Name: NEXT_PUBLIC_BASE_URL
Value: https://www.festivalpucon.cl
Environments: ☑ Production
```

```
Name: NEXT_PUBLIC_BASE_URL
Value: <se-genera-automaticamente>
Environments: ☑ Preview
```

5. Click en **Save** para cada variable

---

### 3.3 Obtener Preview URL

1. Después del push, Vercel crea automáticamente un deployment
2. Ir a: **Deployments** en Vercel
3. Buscar el deployment del branch `feature/mercado-pago-payment`
4. Copiar la URL (ej: `https://feature-mercado-pago-payment-xxx.vercel.app`)

---

## ✅ Paso 4: Verificar que la API Funciona

### 4.1 Probar Endpoint de Tipos

**Desde el navegador o terminal:**

```
https://<tu-preview-url>/api/tickets/types
```

**O local:**
```
http://localhost:3000/api/tickets/types
```

**Deberías ver JSON con:**
- `ticket_types`: array con General y VIP
- `events`: array con Festival Pucón 2026
- `inventory`: array con 2 elementos (capacidades)

**Si ves esto → ✅ API funciona correctamente**

---

## ✅ Paso 5: Configurar Webhook en Mercado Pago

### 5.1 En Panel de Mercado Pago

1. Ir a: https://www.mercadopago.cl/developers/panel
2. Seleccionar tu aplicación
3. Ir a: **Configuración** → **Webhooks**
4. Click en **Agregar URL de webhook**
5. URL: `https://<tu-preview-url>/api/webhooks/mercadopago`
6. Eventos: Seleccionar **payment**
7. Guardar

**Nota:** Para pruebas locales, necesitarás usar ngrok (ver `PLAN_PRUEBAS_MP.md`)

---

## ✅ Checklist Final

Antes de hacer la primera prueba completa:

### Datos:
- [ ] Datos insertados en Supabase
- [ ] Verificación SQL muestra datos correctos
- [ ] Endpoint `/api/tickets/types` retorna datos

### Credenciales:
- [ ] `SUPABASE_URL` configurada en Vercel
- [ ] `SUPABASE_ANON_KEY` configurada en Vercel
- [ ] `MP_ACCESS_TOKEN` configurada en Vercel
- [ ] `RESEND_API_KEY` configurada (opcional)
- [ ] `NEXT_PUBLIC_BASE_URL` configurada

### Deployment:
- [ ] Branch pusheado a GitHub
- [ ] Preview URL de Vercel disponible
- [ ] Variables de entorno configuradas en Vercel
- [ ] Deployment exitoso sin errores

### Webhook:
- [ ] URL de webhook configurada en MP
- [ ] Evento "payment" seleccionado

---

## 🚀 Siguiente Paso: Primera Prueba

Una vez completado este checklist:

**Seguir con:** `PLAN_PRUEBAS_MP.md` → Sección "Flujo de Prueba Completo"

---

## ¿Necesitas Ayuda?

Si tienes problemas en algún paso, indica cuál y te guío específicamente:
- ❓ Push a GitHub
- ❓ Configurar Vercel
- ❓ Obtener credenciales
- ❓ Configurar webhook
