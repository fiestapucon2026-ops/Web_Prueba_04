# PLAN DE CONVERSACIONES SEPARADAS

## PRINCIPIO FUNDAMENTAL
**Una conversación = Un objetivo = Menos errores**

---

## CONVERSACIONES COMPLETADAS ✅

### 1. "Frontend - Página Principal y UI"
**Estado:** ✅ COMPLETADA Y RESPALDADA
**Objetivo:** Ventanas con hover, botones volver, diseño responsive
**Resultado:** Página principal funcional con efecto hover en 4 ventanas + soporte táctil móviles
**Tag:** `fase-0-estable`
**Fecha cierre:** 2026-01-XX
**Commit:** `fa84278`

---

## CONVERSACIONES PLANIFICADAS

### 2. "Backend - Mercado Pago Payment Integration"
**Objetivo único:** Integración de pagos con Mercado Pago
**Alcance:**
- Configurar credenciales de Mercado Pago
- Crear preferencia de pago
- Manejar webhooks de confirmación
- Guardar pagos en base de datos
- **NO incluir:** Emails, QR, control diario

**Branch:** `feature/mercado-pago-payment`
**Archivos a crear/modificar:**
- `src/app/api/payments/mercado-pago/route.ts`
- `src/lib/services/payment.service.ts`
- Variables de entorno: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`

**Criterio de éxito:**
- Pago exitoso en Mercado Pago
- Webhook recibido y procesado
- Pago guardado en BD
- **Tag:** `v1.0-payment-working`

**Cuándo iniciar:** ✅ LISTO - Fase 0 respaldada con tag `fase-0-estable`
**Estado:** Pendiente de iniciar en nueva conversación

---

### 3. "Backend - Email QR Service"
**Objetivo único:** Envío de emails con QR después de pago exitoso
**Alcance:**
- Configurar servicio de email (SendGrid/Resend/Nodemailer)
- Generar QR code para ticket
- Enviar email con QR adjunto/embebido
- Manejar errores de envío (guardar para reenvío)
- **NO modificar:** Lógica de pagos existente

**Branch:** `feature/email-qr-service`
**Archivos a crear/modificar:**
- `src/app/api/emails/send-qr/route.ts`
- `src/lib/services/email.service.ts`
- `src/lib/services/qr.service.ts`
- Variables de entorno: `EMAIL_API_KEY`, `EMAIL_FROM`

**Criterio de éxito:**
- Email enviado después de pago
- QR generado correctamente
- Email recibido por cliente
- **Tag:** `v1.1-email-working`

**Cuándo iniciar:** Después de que Mercado Pago esté estable y con tag

---

### 4. "Backend - Daily Ticket Control"
**Objetivo único:** Control de ventas por día (17 días de evento)
**Alcance:**
- Crear sistema de control por día
- Límites de venta por día
- Dashboard de control diario
- Reportes de ventas
- **NO afectar:** Pagos ni emails existentes

**Branch:** `feature/daily-ticket-control`
**Archivos a crear/modificar:**
- `src/app/api/tickets/daily-control/route.ts`
- `src/lib/services/daily-control.service.ts`
- `src/app/admin/daily-control/page.tsx` (si aplica)
- Tabla BD: `daily_sales`

**Criterio de éxito:**
- Control de 17 días funcionando
- Límites respetados
- Reportes generados
- **Tag:** `v1.2-daily-control-working`

**Cuándo iniciar:** Después de que emails estén estables

---

### 5. "Deploy - Vercel Production"
**Objetivo único:** Configuración y despliegue en producción
**Alcance:**
- Variables de entorno en Vercel
- Configuración de dominio
- SSL certificates
- Monitoreo de errores
- **NO incluir:** Desarrollo de funcionalidades

**Branch:** `main` (solo despliegues)
**Cuándo iniciar:** Cuando todas las funcionalidades estén en `main` y probadas

---

## REGLAS DE SEPARACIÓN

### ✅ HACER:
- Iniciar nueva conversación para cada funcionalidad
- Nombrar conversación claramente: "Feature: [Nombre]"
- Trabajar en branch separado
- Commitear frecuentemente
- Crear tag cuando funcione
- Cerrar conversación al completar

### ❌ NO HACER:
- Mezclar más de 1 funcionalidad en una conversación
- Modificar código de otra funcionalidad sin nueva conversación
- Mergear a main sin tag estable
- Continuar en conversación con más de 50 mensajes
- Trabajar en main directamente (excepto hotfixes)

---

## CHECKLIST ANTES DE NUEVA CONVERSACIÓN

Antes de iniciar nueva conversación, verificar:
- [ ] Conversación anterior cerrada y documentada
- [ ] Último estado estable con tag
- [ ] Branch creado para nueva funcionalidad
- [ ] Objetivo único y claro definido
- [ ] Archivos a modificar identificados
- [ ] Variables de entorno documentadas
- [ ] Criterio de éxito definido

---

## SEÑALES DE CONTAMINACIÓN

Cambiar inmediatamente a nueva conversación si:
- ❌ Mezclas 2+ temas diferentes
- ❌ Contexto > 50 mensajes
- ❌ Explicas algo que ya explicaste
- ❌ Hay confusión sobre qué hacer
- ❌ Terminaste funcionalidad y empiezas otra
- ❌ Algo se desconfiguró y no sabes por qué

---

## RECUPERACIÓN DE ERRORES

Si algo se desconfigura:
1. **DETENER** trabajo actual
2. **CERRAR** conversación actual
3. **REVISAR** último tag estable: `git tag -l`
4. **VOLVER** a estado estable: `git checkout [tag]`
5. **INICIAR** nueva conversación para arreglar
6. **DOCUMENTAR** qué falló en `DECISIONES.md`

---

## ÚLTIMA ACTUALIZACIÓN

Fecha: 2026-01-XX
Conversación actual: "Frontend - Página Principal" ✅ COMPLETADA
Próxima conversación: "Backend - Mercado Pago Payment Integration"
