# Prompt para nuevo chat — Módulo Admin Stock + Cambios de Seguridad

**Pega este bloque como primer mensaje en un nuevo chat para continuar con contexto completo.**

---

## ⛔ MÓDULO ADMIN/SEGURIDAD — TERMINADO Y 100% OPERATIVO

**Cualquier cambio en este módulo requiere DOBLE RATIFICACIÓN** (Análisis → Propuesta → autorización explícita "Autorizado/Proceed" del usuario antes de ejecutar).

Archivos afectados por esta regla: `src/app/admin/*`, `src/app/api/admin/*`, `src/lib/admin-*.ts`, `src/lib/admin-session*.ts`, `src/middleware.ts`, `public/robots.txt`, migración `admin_update_daily_inventory_rpc.sql`.

---

## Contexto del proyecto

| Campo | Valor |
|-------|-------|
| Proyecto | web_oficial_festival (Festival Pucón 2026) |
| Stack | Next.js 16.1.4, TypeScript (strict), Tailwind, Vercel, Mercado Pago, Supabase |
| Dominio | www.festivalpucon.cl |
| Regla (.cursorrules) | Análisis → Propuesta → Ejecución solo tras "Autorizado/Proceed" |

---

## Lo que NO debe tocar (doble ratificación)

- Página de inicio: `src/app/page.tsx`, `src/components/pantalla-inicio/PantallaInicio.tsx`
- APIs: `src/app/api/entradas/*`, `src/app/api/tickets/create-preference`, `src/app/api/webhooks/mercadopago`
- Esquema BD: tablas `orders`, `tickets`, `inventory`, `daily_inventory`, `event_days`
- Flujo de pago (delegación 1 ítem vs preferencia MP directa)

---

## Cambios realizados (sesión 2026-01-30)

### Módulo Entradas — Estéticos (sin respaldo en respaldo_mod_venta_tickets)
| Archivo | Cambio |
|---------|--------|
| `src/components/date-selector/DateSelector.tsx` | 12 colores hex por rectángulo; texto por luminancia; días en negrita |
| `src/components/checkout/TicketSelector.tsx` | "Sin vehículo"; promo 0→max; "(Es uno por ticket: Máx X)" |
| `src/app/entradas/page.tsx` | Botones Volver: verde (tickets), azul (datos) |
| `src/components/checkout/CustomerForm.tsx` | Botón Continuar azul (bg-blue-600) |

### Módulo Admin Stock (estado actual)
| Componente | Detalle |
|------------|---------|
| Ruta | `/admin/stock` |
| APIs | `GET /api/admin/inventory`, `PATCH /api/admin/inventory/[id]`, `POST /api/admin/login`, `POST /api/admin/logout` |
| Auth | Cookie HttpOnly `admin_session` (24 h) o header `x-admin-key` (compatibilidad) |
| Persistencia | Cookie HttpOnly; **sin** `sessionStorage` |
| Archivos | `src/app/admin/stock/page.tsx`, `src/app/api/admin/inventory/route.ts`, `src/app/api/admin/inventory/[id]/route.ts`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/lib/admin-auth.ts`, `src/lib/admin-auth-edge.ts`, `src/lib/admin-session.ts`, `src/lib/admin-session-edge.ts`, `src/middleware.ts`, `public/robots.txt` |
| Precio PROMO | Se edita en la misma pantalla admin/stock (es un tipo de ticket en `daily_inventory`) |

### Respaldo — Restauración

**Carpeta:** `respaldo_mod_venta_tickets/` (raíz del proyecto)

**Mapa origen ← respaldo:**
```
src/app/api/admin/inventory/route.ts           ← respaldo_mod_venta_tickets/src/app/api/admin/inventory/route.ts
src/app/api/admin/inventory/[id]/route.ts      ← respaldo_mod_venta_tickets/src/app/api/admin/inventory/[id]/route.ts
src/app/admin/stock/page.tsx                   ← respaldo_mod_venta_tickets/src/app/admin/stock/page.tsx
next.config.ts                                 ← respaldo_mod_venta_tickets/next.config.ts
vercel.json                                    ← respaldo_mod_venta_tickets/vercel.json
package.json                                   ← respaldo_mod_venta_tickets/package.json
```

**Alcance:** Solo admin y config. Los cambios estéticos de entradas (DateSelector, TicketSelector, etc.) no están respaldados aquí.

---

## Auditoría seguridad (admin)

### Hallazgos
- `key === secret` (no constant-time)
- Clave en `sessionStorage` (XSS)
- Sin `robots.txt`
- `daysError?.message`, `updateErr.message` expuestos
- Sin rate limit, middleware, auditoría, validación UUID en PATCH
- RLS: `service_role` único en tablas sensibles ✓

### Cambios sugeridos (todos implementados ✓)

| Riesgo | Cambio | Estado |
|--------|--------|--------|
| Alto | Middleware /admin | ✓ `src/middleware.ts` |
| Alto | Sesión HttpOnly | ✓ Login/logout, cookie HttpOnly, sin sessionStorage |
| Medio | Rate limit, CSP, Transacción PATCH | ✓ middleware; RPC `admin_update_daily_inventory` |
| Bajo | Timing-safe, UUID, sanitizar errores | ✓ admin-auth.ts, routes |
| Cero | robots.txt | ✓ `public/robots.txt` |

### Sanitización errores
Reemplazar `daysError?.message` y `updateErr.message` por `"Error interno"`. No exponer mensajes de Supabase.

### Timing-safe
Derivar ambos a longitud fija: `const ah = crypto.createHash('sha256').update(a).digest('hex'); const bh = crypto.createHash('sha256').update(b).digest('hex');` Luego `crypto.timingSafeEqual(Buffer.from(ah,'hex'), Buffer.from(bh,'hex'))`. Entrada: `a` = header value, `b` = `ADMIN_SECRET`.

### Validación UUID
En PATCH, antes de usar: `z.string().uuid().safeParse(dailyInventoryId)` (viene de `context.params`, no del body).

### Restauración (comandos desde raíz del proyecto)
```bash
cp respaldo_mod_venta_tickets/src/app/api/admin/inventory/route.ts src/app/api/admin/inventory/
cp "respaldo_mod_venta_tickets/src/app/api/admin/inventory/[id]/route.ts" "src/app/api/admin/inventory/[id]/"
cp respaldo_mod_venta_tickets/src/app/admin/stock/page.tsx src/app/admin/stock/
cp respaldo_mod_venta_tickets/next.config.ts .
cp respaldo_mod_venta_tickets/vercel.json .
cp respaldo_mod_venta_tickets/package.json .
```

---

## Orden implementación (bajo riesgo)

1. `public/robots.txt` — contenido:
   ```
   User-agent: *
   Disallow: /admin
   ```
2. `src/lib/admin-auth.ts` — `verifyAdminKey` con timing-safe (exportar función)
3. Actualizar `route.ts` y `[id]/route.ts`: import desde `@/lib/admin-auth`, eliminar función local
4. Sanitizar respuestas 500 en ambos route
5. Validar UUID en PATCH (params) con `z.string().uuid().safeParse`
6. Resto según prioridad

---

## Referencias

- `RESUMEN_PARA_NUEVO_CHAT.md`
- `PROMPT_MODULO_TICKETS_QR_EMAIL.md`
- `respaldo_mod_venta_tickets/README.md`
- `.env.example`

---

## Implementado (sesión 2026-01-31)

- `public/robots.txt`: User-agent * / Disallow /admin
- `src/lib/admin-auth.ts`: `verifyAdminKey` (timing-safe), `verifyAdminKeyFromBody`; acepta header o cookie
- `src/lib/admin-auth-edge.ts`: verificación Edge (Web Crypto); acepta header o cookie
- `src/lib/admin-session.ts`: crear/verificar token HMAC, cookie Path=/api/admin, 24 h
- `src/lib/admin-session-edge.ts`: verificación cookie en Edge
- `src/app/api/admin/login/route.ts`: POST { key }; valida y setea cookie HttpOnly
- `src/app/api/admin/logout/route.ts`: POST; borra cookie
- `src/middleware.ts`: matcher /admin, /api/admin; rate limit 60/min; auth (excepto POST login/logout); CSP
- Rutas inventory: sanitización 500, UUID en PATCH; PATCH vía RPC `admin_update_daily_inventory`
- `supabase/migrations/admin_update_daily_inventory_rpc.sql`: función atómica daily_inventory + inventory
- `src/app/admin/stock/page.tsx`: login vía API, `credentials: 'include'`, sin sessionStorage

---

## Instrucción asistente

Módulo Admin terminado. **Cualquier cambio requiere DOBLE RATIFICACIÓN.** No tocar APIs entradas, webhook, BD (MP).

---

## Orden lógico de siguientes pasos (opciones)

| Orden | Opción | Descripción |
|-------|--------|-------------|
| **1** | **Documentar** | Actualizar este prompt y RESUMEN_ESTADO.md con lo implementado; dejar explícito "módulo terminado" y "doble ratificación para cambios". |
| **2** | **Deploy** | Revisar checklist Vercel: `ADMIN_SECRET` en producción (valor fuerte, no el de pruebas); migración RPC aplicada en Supabase; CSP/headers si aplica. |
| **3** | **Otro módulo** | Seguir con el siguiente módulo del proyecto (ej. tickets/QR/email según PROMPT_MODULO_TICKETS_QR_EMAIL.md o el que definas). |
| **4** | **Nada por ahora** | Cerrar este módulo y retomar cuando haya un objetivo nuevo. |

**Recomendación:** 1 → 2 → 3 o 4 (documentar primero, luego deploy, luego otro módulo o pausa).

---

## [AUDITORÍA V2] CIT 98

**Correcciones:** Timing-safe con derivación SHA-256 explícita; validación UUID en params (no body); secuencia de pasos con actualización de imports; comandos cp concretos para restauración; formato robots.txt completo.
