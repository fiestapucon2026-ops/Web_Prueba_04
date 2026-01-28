# Plan de Pruebas - Integración Mercado Pago

## Estado Actual

✅ **Código implementado:**
- Backend API completo
- Frontend actualizado
- Webhook handler
- Generación de PDFs
- Envío de emails

⏳ **Pendiente para pruebas:**
- Variables de entorno
- Datos en Supabase
- Deploy en Vercel
- Credenciales de Mercado Pago

---

## Checklist Pre-Pruebas

### 1. Variables de Entorno (REQUERIDO)

#### En Vercel (Settings → Environment Variables):

**Mercado Pago:**
- [ ] `MP_ACCESS_TOKEN` - Access Token de Mercado Pago (Test o Production)

**Supabase:**
- [ ] `SUPABASE_URL` - URL del proyecto Supabase
- [ ] `SUPABASE_ANON_KEY` - Anon/Public Key de Supabase

**Resend (Email):**
- [ ] `RESEND_API_KEY` - API Key de Resend
- [ ] Verificar dominio en Resend: `festivalpucon.cl` o usar dominio verificado

**URL Base:**
- [ ] `NEXT_PUBLIC_BASE_URL` - URL del deployment (ej: `https://feature-mercado-pago-payment-xxx.vercel.app`)

#### Para Desarrollo Local (`.env.local`):
```bash
MP_ACCESS_TOKEN=TEST-xxxxx-xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
RESEND_API_KEY=re_xxxxx
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

### 2. Datos en Supabase (REQUERIDO)

#### Crear tablas (si no existen):
```sql
-- Ya deberían existir según el schema, pero verificar:
SELECT * FROM events;
SELECT * FROM ticket_types;
SELECT * FROM inventory;
SELECT * FROM orders;
```

#### Insertar datos de prueba:

**Evento:**
```sql
INSERT INTO events (id, name, date, venue)
VALUES (
  gen_random_uuid(),
  'Festival Pucón 2026',
  '2026-01-15 18:00:00+00',
  'Camping Pucón'
)
RETURNING id; -- Guardar este UUID
```

**Tipos de Tickets:**
```sql
INSERT INTO ticket_types (id, name, price)
VALUES 
  (gen_random_uuid(), 'General', 10000),
  (gen_random_uuid(), 'VIP', 25000)
RETURNING id; -- Guardar estos UUIDs
```

**Inventario:**
```sql
-- Reemplazar event_id y ticket_type_id con los UUIDs obtenidos
INSERT INTO inventory (event_id, ticket_type_id, total_capacity)
VALUES 
  ('<event_id>', '<ticket_type_general_id>', 100),
  ('<event_id>', '<ticket_type_vip_id>', 50)
ON CONFLICT (event_id, ticket_type_id) DO NOTHING;
```

---

### 3. Credenciales de Mercado Pago

#### Opción A: Modo Test (Sandbox) - RECOMENDADO PARA PRIMERA PRUEBA

1. Ir a: https://www.mercadopago.cl/developers/panel
2. Crear aplicación de prueba
3. Obtener **Access Token de Test**
4. Usar tarjetas de prueba:
   - Aprobada: `5031 7557 3453 0604` (CVV: 123)
   - Rechazada: `5031 4332 1540 6351` (CVV: 123)
   - Pendiente: `5031 4332 1540 6351` (CVV: 123)

#### Opción B: Modo Production

1. Completar proceso de homologación en Mercado Pago
2. Obtener **Access Token de Production**
3. Configurar webhook URL en panel de Mercado Pago

---

### 4. Configuración de Webhook

#### En Mercado Pago Panel:
1. Ir a: Configuración → Webhooks
2. Agregar URL: `https://<tu-url-vercel>/api/webhooks/mercadopago`
3. Eventos a escuchar: `payment`

#### Para pruebas locales (usar ngrok):
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto local
ngrok http 3000

# Usar URL de ngrok en webhook de MP
# Ejemplo: https://abc123.ngrok.io/api/webhooks/mercadopago
```

---

## Opciones de Prueba

### Opción 1: Vercel Preview (RECOMENDADO) ⭐

**Ventajas:**
- URL pública automática
- Variables de entorno fáciles de configurar
- No requiere tunneling
- Aislado de producción

**Pasos:**
1. Push branch `feature/mercado-pago-payment` a GitHub
2. Vercel crea automáticamente preview URL
3. Configurar variables de entorno en Vercel (Settings → Environment Variables)
4. Seleccionar branch `feature/mercado-pago-payment` en variables
5. Configurar webhook en MP con preview URL
6. Probar flujo completo

**Tiempo estimado:** 15-30 minutos

---

### Opción 2: Desarrollo Local + ngrok

**Ventajas:**
- Control total del entorno
- Debugging más fácil
- No requiere deploy

**Pasos:**
1. Crear `.env.local` con variables de entorno
2. Ejecutar `npm run dev`
3. Iniciar ngrok: `ngrok http 3000`
4. Configurar webhook en MP con URL de ngrok
5. Probar flujo completo

**Tiempo estimado:** 10-20 minutos

---

### Opción 3: Vercel Production (Solo si todo está listo)

**Requisitos:**
- ✅ Todas las pruebas en preview exitosas
- ✅ Credenciales de producción configuradas
- ✅ Dominio verificado en Resend
- ✅ Webhook configurado en MP production

**NO RECOMENDADO para primera prueba**

---

## Flujo de Prueba Completo

### Paso 1: Verificar Endpoints
```bash
# Verificar que /api/tickets/types funciona
curl https://<url>/api/tickets/types

# Debe retornar: events, ticket_types, inventory
```

### Paso 2: Crear Preferencia
1. Ir a `/tickets` en el navegador
2. Seleccionar evento
3. Seleccionar tipo de ticket
4. Ingresar cantidad y email
5. Click en "Comprar con Mercado Pago"
6. **Verificar:** Redirección a Mercado Pago

### Paso 3: Procesar Pago (Test)
1. En Mercado Pago, usar tarjeta de prueba
2. Completar pago
3. **Verificar:** Redirección a `/success` (o URL configurada)

### Paso 4: Verificar Webhook
1. Revisar logs en Vercel
2. **Verificar:** Webhook recibido y procesado
3. **Verificar:** Orden actualizada en Supabase (`status = 'paid'`)

### Paso 5: Verificar Email
1. Revisar inbox del email usado
2. **Verificar:** Email recibido con PDF adjunto
3. **Verificar:** PDF contiene información correcta

### Paso 6: Verificar PDF
1. Descargar PDF del email
2. **Verificar:** Información correcta
3. **Verificar:** QR code presente (placeholder)

---

## Checklist de Verificación

### Funcionalidad Básica
- [ ] `/api/tickets/types` retorna datos correctos
- [ ] Frontend carga eventos y tipos de tickets
- [ ] Selección de evento funciona
- [ ] Selección de tipo de ticket funciona
- [ ] Stock disponible se muestra correctamente
- [ ] Validación de cantidad funciona
- [ ] Validación de email funciona

### Integración Mercado Pago
- [ ] Preferencia se crea correctamente
- [ ] Redirección a MP funciona
- [ ] Pago de prueba se procesa
- [ ] Redirección post-pago funciona

### Webhook
- [ ] Webhook se recibe correctamente
- [ ] Orden se actualiza en BD
- [ ] Idempotencia funciona (no procesa duplicados)
- [ ] Estados correctos (approved, rejected, pending)

### Email y PDF
- [ ] Email se envía correctamente
- [ ] PDF se genera correctamente
- [ ] PDF contiene información correcta
- [ ] Email contiene información correcta

### Base de Datos
- [ ] Orden se crea con status 'pending'
- [ ] Orden se actualiza a 'paid' después del pago
- [ ] `mp_payment_id` se guarda correctamente
- [ ] Stock se calcula correctamente

---

## Problemas Comunes y Soluciones

### Error: "MP_ACCESS_TOKEN no está configurado"
**Solución:** Verificar variable de entorno en Vercel o `.env.local`

### Error: "Supabase no está configurado"
**Solución:** Verificar `SUPABASE_URL` y `SUPABASE_ANON_KEY`

### Webhook no se recibe
**Solución:** 
- Verificar URL del webhook en MP
- Verificar que la URL sea pública (no localhost sin ngrok)
- Revisar logs de Vercel

### Email no se envía
**Solución:**
- Verificar `RESEND_API_KEY`
- Verificar dominio verificado en Resend
- Revisar logs de Resend dashboard

### PDF no se genera
**Solución:**
- Verificar que la orden existe en BD
- Revisar logs de error en Vercel
- Verificar que `@react-pdf/renderer` está instalado

---

## Próximos Pasos Inmediatos

1. **Configurar Supabase:**
   - [ ] Crear proyecto Supabase (si no existe)
   - [ ] Ejecutar schema SQL
   - [ ] Insertar datos de prueba

2. **Obtener Credenciales:**
   - [ ] Access Token de Mercado Pago (Test)
   - [ ] Credenciales de Supabase
   - [ ] API Key de Resend

3. **Deploy en Vercel:**
   - [ ] Push branch a GitHub
   - [ ] Configurar variables de entorno
   - [ ] Obtener preview URL

4. **Configurar Webhook:**
   - [ ] Agregar URL en panel de MP
   - [ ] Probar recepción

5. **Ejecutar Prueba Completa:**
   - [ ] Seguir flujo de prueba
   - [ ] Verificar cada paso
   - [ ] Documentar resultados

---

## Tiempo Estimado Total

- **Setup inicial:** 30-60 minutos
- **Primera prueba completa:** 15-30 minutos
- **Total:** 45-90 minutos

---

## ¿Cuándo Estamos Listos?

**Estamos listos para la primera prueba cuando:**
- ✅ Todas las variables de entorno configuradas
- ✅ Datos de prueba en Supabase
- ✅ Preview URL de Vercel disponible
- ✅ Webhook configurado en MP
- ✅ Credenciales de test de MP obtenidas

**¿Tienes acceso a estas credenciales/configuraciones?**
- Si SÍ → Podemos proceder inmediatamente
- Si NO → Necesitamos crearlas primero
