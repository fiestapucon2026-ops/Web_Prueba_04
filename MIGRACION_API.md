# Migración de API - Mercado Pago

## Breaking Changes

### Endpoint Deprecado: `/api/checkout`

**Estado:** ⚠️ DEPRECATED - Será eliminado en versión futura

**Razones:**
- No valida precios desde BD (riesgo de seguridad)
- No valida stock disponible
- No persiste órdenes en BD
- No soporta múltiples eventos

**Migración:**

#### Antes (Deprecado):
```typescript
POST /api/checkout
Body: {
  title: string,
  quantity: number,
  price: number  // ⚠️ Inseguro: viene del frontend
}
```

#### Después (Nuevo):
```typescript
POST /api/tickets/create-preference
Body: {
  event_id: string (UUID),
  ticket_type_id: string (UUID),
  quantity: number,
  payer_email: string
}
```

---

## Nuevos Endpoints

### `GET /api/tickets/types`

Obtiene información dinámica de eventos, tipos de tickets e inventario disponible.

**Response:**
```typescript
{
  ticket_types: Array<{
    id: string,
    name: string,
    price: number
  }>,
  events: Array<{
    id: string,
    name: string,
    date: string,
    venue: string
  }>,
  inventory: Array<{
    id: string,
    event_id: string,
    ticket_type_id: string,
    total_capacity: number,
    available_stock: number
  }>
}
```

**Uso:**
- Cargar datos dinámicamente en frontend
- Eliminar hardcoded ticket types
- Mostrar stock disponible en tiempo real

---

### `POST /api/tickets/create-preference`

Crea una preferencia de pago en Mercado Pago con validación completa.

**Validaciones:**
- ✅ Precios desde BD (no acepta precios del frontend)
- ✅ Stock disponible
- ✅ Persistencia de orden en BD
- ✅ Validación con Zod schemas compartidos

**Request:**
```typescript
{
  event_id: string (UUID),
  ticket_type_id: string (UUID),
  quantity: number (1-10),
  payer_email: string (email válido)
}
```

**Response:**
```typescript
{
  init_point: string  // URL de redirección a Mercado Pago
}
```

---

## Cambios en Frontend

### `src/app/tickets/page.tsx`

**Cambios principales:**
1. ✅ Carga datos dinámicos desde `/api/tickets/types`
2. ✅ Selección de evento (antes hardcoded)
3. ✅ Selección de tipo de ticket desde BD
4. ✅ Validación con schemas compartidos
5. ✅ Muestra stock disponible en tiempo real
6. ✅ Usa nueva API con `event_id` y `ticket_type_id`

**Antes:**
- Hardcoded `TICKET_OPTIONS`
- Payload: `{ticketTypeId: 'general'|'vip', quantity, payerEmail}`
- Sin validación de stock
- Sin selección de evento

**Después:**
- Datos dinámicos desde API
- Payload: `{event_id: UUID, ticket_type_id: UUID, quantity, payer_email}`
- Validación de stock en tiempo real
- Selección de evento y tipo de ticket

---

## Schemas Compartidos

### `src/lib/schemas.ts`

Schemas Zod compartidos para validación consistente entre frontend y backend.

**Schemas disponibles:**
- `CreatePreferenceSchema`: Validación completa de creación de preferencia
- `EmailSchema`: Validación de email
- `QuantitySchema`: Validación de cantidad (1-10)
- `UUIDSchema`: Validación de UUID

**Uso:**
```typescript
import { CreatePreferenceSchema, EmailSchema } from '@/lib/schemas';

// Backend
const validation = CreatePreferenceSchema.safeParse(body);

// Frontend (validación manual pero consistente)
const emailValidation = EmailSchema.safeParse(email);
```

---

## Checklist de Migración

- [x] Endpoint `/api/checkout` marcado como deprecated
- [x] Nuevo endpoint `/api/tickets/create-preference` implementado
- [x] Endpoint `/api/tickets/types` para datos dinámicos
- [x] Schemas compartidos creados
- [x] Frontend actualizado para usar nueva API
- [x] Validación de stock implementada
- [x] Validación de precios desde BD
- [ ] Tests de integración (pendiente)
- [ ] Documentación de API completa (pendiente)

---

## Notas de Seguridad

1. **Precios:** Ahora se validan desde BD, no se aceptan del frontend
2. **Stock:** Validación atómica (aunque aún requiere mejoras para race conditions)
3. **Validación:** Schemas compartidos garantizan consistencia
4. **Persistencia:** Todas las órdenes se guardan en BD antes de crear preferencia MP

---

## Próximos Pasos

1. Eliminar endpoint `/api/checkout` después de confirmar que no se usa
2. Implementar transacciones atómicas para validación de stock (P0)
3. Agregar tests de integración
4. Documentar API completa con OpenAPI/Swagger
