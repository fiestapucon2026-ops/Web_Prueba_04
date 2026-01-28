# Arquitectura Modular - Festival Pucón

## Principio de Diseño

**Cada módulo es independiente y funcional por sí solo.**
El fracaso de un módulo no afecta a los demás.

---

## Módulos del Sistema

### 🎫 Módulo 1: Venta de Tickets (Mercado Pago)
**Estado:** ✅ En desarrollo - Branch `feature/mercado-pago-pago`

**Responsabilidades:**
- Creación de preferencias de pago
- Procesamiento de webhooks de MP
- Generación de PDFs de tickets
- Envío de emails con tickets
- Persistencia de órdenes en BD

**Dependencias:**
- Supabase (solo lectura/escritura de `orders`, `inventory`, `events`, `ticket_types`)
- Mercado Pago API
- Resend (email)

**Aislamiento:**
- ✅ Si falla MP → Solo afecta ventas nuevas, no datos existentes
- ✅ Si falla email → Orden se guarda igual, email se puede reenviar
- ✅ Si falla PDF → Orden se guarda igual, PDF se puede regenerar
- ✅ No modifica `PantallaInicio.tsx` (protegido)

**Tablas que usa:**
- `events` (lectura)
- `ticket_types` (lectura)
- `inventory` (lectura)
- `orders` (lectura/escritura)

**Tablas que NO modifica:**
- Ninguna otra tabla (aislado)

---

### 📊 Módulo 2: Gestión de Datos (Futuro)
**Estado:** ⏳ Pendiente

**Responsabilidades:**
- CRUD de eventos
- CRUD de tipos de tickets
- Gestión de inventario
- Reportes y analytics
- Dashboard administrativo

**Dependencias:**
- Supabase (todas las tablas)
- Posiblemente autenticación

**Aislamiento:**
- ✅ Si falla → No afecta ventas en curso
- ✅ Puede funcionar independientemente del módulo MP
- ✅ Datos compartidos pero lógica separada

**Tablas que usará:**
- `events` (CRUD completo)
- `ticket_types` (CRUD completo)
- `inventory` (CRUD completo)
- `orders` (lectura para reportes)

---

## Separación de Concerns

### Base de Datos
```
┌─────────────────────────────────────┐
│         Supabase (PostgreSQL)        │
├─────────────────────────────────────┤
│  events                              │
│  ticket_types                        │
│  inventory                           │
│  orders  ← Módulo MP escribe aquí    │
└─────────────────────────────────────┘
         ↑                    ↑
         │                    │
    Módulo MP          Módulo Gestión
   (Venta)            (Administración)
```

### Código
```
src/
├── app/
│   ├── api/
│   │   ├── tickets/          ← Módulo MP
│   │   │   ├── create-preference/
│   │   │   ├── types/
│   │   │   └── generate-pdf/
│   │   └── webhooks/
│   │       └── mercadopago/   ← Módulo MP
│   └── tickets/
│       └── page.tsx           ← Módulo MP (Frontend)
│
├── components/
│   └── pantalla-inicio/      ← PROTEGIDO (no tocar)
│
└── lib/
    ├── mercadopago.ts        ← Módulo MP
    ├── supabase.ts           ← Compartido
    ├── email.ts              ← Módulo MP
    ├── pdf.tsx               ← Módulo MP
    └── schemas.ts            ← Compartido
```

---

## Protección de Módulos Existentes

### PantallaInicio.tsx
- ✅ **NO modificado** en branch `feature/mercado-pago-payment`
- ✅ **Protegido** por protocolo de doble confirmación
- ✅ **Aislado** - No depende de módulo MP

### Producción Actual
- ✅ **No afectada** - Branch separado
- ✅ **Preview URL** - Testing aislado
- ✅ **Merge controlado** - Solo después de pruebas

---

## Flujo de Datos

### Módulo MP (Venta)
```
Usuario → Frontend (/tickets)
    ↓
API: /api/tickets/create-preference
    ↓
Validar stock en Supabase
    ↓
Crear orden (status: 'pending')
    ↓
Crear preferencia en MP
    ↓
Usuario paga en MP
    ↓
Webhook: /api/webhooks/mercadopago
    ↓
Actualizar orden (status: 'paid')
    ↓
Generar PDF
    ↓
Enviar email
```

### Módulo Gestión (Futuro)
```
Admin → Dashboard
    ↓
CRUD de eventos/tickets
    ↓
Actualizar Supabase
    ↓
Módulo MP lee cambios automáticamente
```

---

## Ventajas de esta Arquitectura

1. **Desarrollo Paralelo:**
   - Módulo MP puede desarrollarse sin afectar otros
   - Módulo Gestión puede desarrollarse después

2. **Testing Aislado:**
   - Cada módulo se prueba independientemente
   - Fracaso de uno no bloquea al otro

3. **Deployment Gradual:**
   - Módulo MP puede deployarse sin afectar producción
   - Módulo Gestión puede deployarse después

4. **Mantenimiento:**
   - Bugs en un módulo no afectan otros
   - Actualizaciones independientes

5. **Escalabilidad:**
   - Cada módulo puede escalar independientemente
   - Recursos optimizados por módulo

---

## Reglas de Aislamiento

### ✅ Permitido
- Módulo MP lee/escribe en `orders`
- Módulo MP lee `events`, `ticket_types`, `inventory`
- Módulo Gestión (futuro) hace CRUD completo
- Compartir schemas de validación

### ❌ Prohibido
- Módulo MP modifica `PantallaInicio.tsx`
- Módulo MP modifica lógica de otros módulos
- Módulo Gestión modifica lógica de MP
- Dependencias circulares entre módulos

---

## Estado Actual

**Módulo MP:**
- ✅ Backend completo
- ✅ Frontend completo
- ⏳ Pendiente: Pruebas con datos reales
- ⏳ Pendiente: Deploy en preview

**Módulo Gestión:**
- ⏳ Pendiente: Diseño
- ⏳ Pendiente: Implementación

**Producción:**
- ✅ Funcionando en `www.festivalpucon.cl`
- ✅ `PantallaInicio.tsx` intacto
- ✅ Sin cambios en producción
