# Cómo dejar operativo el módulo /entradas

El módulo ya está implementado (página `/entradas`, APIs `/api/entradas/inventory` y `/api/entradas/create-preference`). Para que funcione en **local** y en **Vercel** hay que completar estos pasos.

---

## 1. Variables de entorno

### Local (`.env.local`)

En la raíz del proyecto crea o edita `.env.local` con al menos:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Opcional (para pago y post-compra):

- `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` — Mercado Pago
- `QR_SIGNING_SECRET` — firma QR en `/checkout/success/[id]`

**Dónde obtener los valores:** Supabase → Dashboard → tu proyecto → **Project Settings** → **API** → Project URL y clave **service_role**.

### Vercel

Ya están configuradas (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). No hace falta añadir nada nuevo para /entradas.

---

## 2. Base de datos (Supabase)

El módulo usa las tablas `event_days`, `daily_inventory` y la columna `event_days.event_id`. Hay que aplicar migraciones y ejecutar el seed **en el mismo proyecto de Supabase** que usa Vercel.

### 2.1 Aplicar migraciones

En Supabase → **SQL Editor**, ejecutar en este orden:

1. Contenido de `supabase/migrations/event_days_daily_inventory.sql` (crea `event_days` y `daily_inventory`).
2. Contenido de `supabase/migrations/entradas_event_id.sql` (añade `event_id` a `event_days`).

Si usas Supabase CLI: `supabase db push` (o aplicar cada archivo manualmente).

### 2.2 Ejecutar el seed

Desde tu máquina, con las variables de Supabase en el entorno (por ejemplo en `.env.local`):

```bash
# Cargar .env.local y ejecutar seed (en Linux/macOS)
export $(grep -v '^#' .env.local | xargs) && npm run db:seed
```

O bien definir las variables a mano:

```bash
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run db:seed
```

El seed crea/actualiza: `ticket_types`, `events`, `event_days` (con `event_id`), `daily_inventory` e `inventory`. Sin esto, `/api/entradas/inventory` devolverá 404 o 503.

---

## 3. Probar en local

1. Reiniciar el servidor de desarrollo (para que cargue `.env.local`):
   ```bash
   npm run dev
   ```
2. Abrir: **http://localhost:3000/entradas**
3. Elegir una fecha → deberían aparecer los tipos de entrada y precios.
4. Pulsar **+** en un tipo → rellenar datos en el formulario → **Continuar** → redirección a Mercado Pago (si `MP_ACCESS_TOKEN` está configurado).

---

## 4. Probar en Vercel

1. Hacer push del branch a GitHub (o disparar un deploy manual en Vercel).
2. Abrir la URL de preview/producción:  
   **https://&lt;tu-dominio-vercel&gt;.vercel.app/entradas**
3. Mismo flujo: fecha → entrada → datos → pago.

Las variables ya están en Vercel; solo hace falta que en Supabase estén aplicadas las migraciones y ejecutado el seed (paso 2).

---

## Resumen

| Dónde       | Acción |
|------------|--------|
| **Local**  | `.env.local` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; migraciones + seed en Supabase; `npm run dev` → http://localhost:3000/entradas |
| **Supabase** | Ejecutar `event_days_daily_inventory.sql` y `entradas_event_id.sql`; luego `npm run db:seed` apuntando a ese proyecto |
| **Vercel** | Sin cambios (env ya configuradas); tras deploy, probar `/entradas` en la URL de Vercel |
