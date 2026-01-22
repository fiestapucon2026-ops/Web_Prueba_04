# DECISIONES DE ARQUITECTURA Y DESARROLLO

## REGLAS CRÍTICAS PERMANENTES

### 1. Página Principal
- **Archivo protegido:** `src/app/page.tsx` y `src/components/pantalla-inicio/PantallaInicio.tsx`
- **Regla:** NO modificar sin doble verificación/autorización explícita del usuario
- **Proceso:** Solicitar autorización → Explicar cambios → Esperar confirmación

### 2. Estrategia de Desarrollo
- **Principio:** Una conversación = Un objetivo = Menos errores
- **Separación:** Cada funcionalidad en conversación separada
- **Branches:** Una funcionalidad = Un branch independiente

### 3. Control de Versiones
- **Main:** Siempre estable, solo código probado
- **Commits:** Pequeños y frecuentes
- **Tags:** En puntos estables (ej: `v1.0-payment-working`)

---

## ESTRUCTURA DE MÓDULOS

### Módulos Independientes (No contaminarse entre sí)

1. **Payment Service** (`lib/services/payment.service.ts`)
   - Solo integración con Mercado Pago
   - No depende de emails ni control diario

2. **Email Service** (`lib/services/email.service.ts`)
   - Solo envío de emails con QR
   - No modifica lógica de pagos

3. **Ticket Service** (`lib/services/ticket.service.ts`)
   - Lógica de creación de tickets
   - Generación de QR

4. **Daily Control Service** (`lib/services/daily-control.service.ts`)
   - Control de ventas por día (17 días)
   - No afecta pagos ni emails

---

## FLUJO DE TRABAJO RECOMENDADO

### Para cada nueva funcionalidad:

1. **Nueva conversación en Cursor**
   - Nombre claro: "Feature: [Nombre funcionalidad]"
   - Un solo objetivo por conversación

2. **Crear branch en Git**
   - `git checkout -b feature/nombre-funcionalidad`
   - Trabajar solo en ese branch

3. **Desarrollo incremental**
   - Implementar funcionalidad
   - Probar aisladamente
   - Commit + tag cuando funcione

4. **Validación antes de merge**
   - Tests unitarios
   - Tests de integración
   - Revisión de código

5. **Merge a main solo cuando esté estable**
   - No mergear código que rompe funcionalidades existentes

---

## CHECKLIST ANTES DE NUEVA FUNCIONALIDAD

- [ ] ¿Es un tema nuevo? → Nueva conversación
- [ ] ¿Es continuación? → Misma conversación
- [ ] ¿Tiene dependencias? → Documentar primero
- [ ] ¿Es crítico? → Guardar en memoria permanente
- [ ] ¿Branch creado? → `git checkout -b feature/nombre`
- [ ] ¿Tests preparados? → Estructura de testing lista

---

## SEÑALES DE CAMBIO DE CONVERSACIÓN

Cambiar a nueva conversación cuando:
- Mezclas más de 2 temas diferentes
- El contexto tiene más de 50 mensajes
- Empiezas a explicar algo que ya explicaste
- Hay confusión sobre qué estás haciendo
- Terminaste una funcionalidad y empiezas otra

---

## PLANIFICACIÓN DE CONVERSACIONES

### Conversaciones separadas recomendadas:

1. **"Frontend - Página Principal"** ✅ COMPLETADA
   - Ventanas con hover
   - Botones volver
   - UI/UX general

2. **"Backend - Mercado Pago Payment"** (Nueva)
   - Solo integración de pagos
   - Sin emails
   - Sin control diario

3. **"Backend - Email QR Service"** (Nueva)
   - Solo envío de emails
   - Solo generación de QR
   - Sin modificar pagos

4. **"Backend - Daily Ticket Control"** (Nueva)
   - Solo control por día
   - Solo lógica de 17 días
   - Sin afectar otros módulos

5. **"Deploy - Vercel"** (Nueva cuando sea necesario)
   - Solo despliegues
   - Solo configuración de producción

---

## MANEJO DE ERRORES

### Si algo se desconfigura:

1. **NO continuar en la misma conversación**
2. **Revisar último commit estable:** `git log --oneline`
3. **Volver a estado estable:** `git checkout [commit-hash]` o `git checkout [tag]`
4. **Crear nueva conversación** para arreglar
5. **Documentar qué falló** en este archivo

### Prevención:

- Commits frecuentes (cada funcionalidad pequeña)
- Tags en puntos estables
- Branches separados por funcionalidad
- Tests antes de merge

---

## VARIABLES DE ENTORNO

Documentar todas las variables necesarias en `.env.example`:
- Mercado Pago keys
- Email service keys
- Database connection
- QR generation config

**NUNCA** commitear `.env` con valores reales.

---

## ÚLTIMA ACTUALIZACIÓN

Fecha: 2026-01-XX
Última decisión: Separación de conversaciones para evitar contaminación de contexto
