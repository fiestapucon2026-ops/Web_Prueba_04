# Plan: PUCÓN ROCK LEGENDS 2026 — Punto inicial y camino

**Rama:** `feature/rock-legends`  
**URL de prueba:** Deploy de Vercel desde esta rama (Preview). Sitio oficial (main) no se toca hasta estar 100%.

**URL de Preview (feature/rock-legends):** _(tras el Paso 2, pegar aquí la URL del deployment de Vercel para esta rama)_

---

## Punto inicial (si el contexto se reinicia)

**Estado actual:** Código listo en rama `feature/rock-legends`. Falta: ejecutar seed en Supabase, probar flujo en Preview y anotar URL.

**Hecho:**
- `scripts/seed-rock-legends.ts` + script npm `db:seed-rock-legends`.
- `src/app/api/entradas-rock/inventory/route.ts` — GET inventario 2026-02-20 (Tickets, Estacionamiento, Promo).
- `src/app/festival/page.tsx` — home anterior (PantallaInicio) respaldada en `/festival`.
- `src/app/page.tsx` — nueva home Rock Legends (`RockLegendsHome`: logo, títulos, 3 bloques, selector, total, botón).
- `src/components/rock-legends/RockLegendsHome.tsx` — selector guarda carrito en `sessionStorage` y redirige a `/entradas-rock`.
- `src/app/entradas-rock/page.tsx` — formulario (CustomerForm), reserve + create-preference, redirect a MP.

**Por hacer:** Seguir las instrucciones paso a paso de la sección **«Instrucciones paso a paso (tu lado)»** más abajo.

---

## Instrucciones paso a paso (tu lado)

Objetivo: un solo evento de tickets para el **20 de febrero 2026** (PUCÓN ROCK LEGENDS 2026). El código ya está; falta cargar datos en Supabase, probar en Preview y anotar la URL.

---

### Paso 1 — Ejecutar el seed en Supabase

1. **Rama correcta**
   - En la raíz del proyecto ejecuta:
     ```bash
     git status
     ```
   - Debes estar en la rama `feature/rock-legends`. Si no: `git checkout feature/rock-legends`.

2. **Variables de entorno**
   - Abre `.env.local` y verifica que existan:
     - `SUPABASE_URL` (URL del proyecto en Supabase).
     - `SUPABASE_SERVICE_ROLE_KEY` (clave de servicio, no la anon key).
   - Si faltan, cópialas desde Supabase: proyecto → Settings → API.

3. **Ejecutar el seed**
   - En la raíz del proyecto:
     ```bash
     npm run db:seed-rock-legends
     ```
   - Debe terminar sin error y mostrar mensajes de creación/actualización de tipos, evento, inventario, etc.

4. **Comprobar**
   - Con el servidor local (`npm run dev`) abre en el navegador:
     `http://localhost:3000/api/entradas-rock/inventory`
   - Debes ver JSON con `inventory` y 3 ítems (Tickets, Estacionamiento, Promo) y `date: "2026-02-20"`. Si ves `inventory: []` o error, el seed no aplicó bien o la fecha no existe en `event_days`.

---

### Paso 2 — Probar el flujo en Preview (Vercel)

1. **Subir la rama**
   - Commit y push de la rama `feature/rock-legends`:
     ```bash
     git add -A
     git status
     git commit -m "Rock Legends 2026: home, entradas-rock, API inventario"
     git push origin feature/rock-legends
     ```

2. **Obtener la URL de Preview**
   - Entra al proyecto en Vercel → pestaña **Deployments**.
   - Localiza el deployment de la rama `feature/rock-legends` (ej. “Preview”).
   - Copia la URL de ese deployment (ej. `https://web-oficial-festival-xxx.vercel.app`). Esa es tu **URL de Preview**.

3. **Variables en Vercel (Preview)**
   - En Vercel: proyecto → **Settings** → **Environment Variables**.
   - Asegúrate de que en **Preview** estén definidas al menos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN` y las que use el flujo de entradas (por ejemplo `NEXT_PUBLIC_BASE_URL` con la URL de Preview si hace falta). Guarda y redeploya si cambias algo.

4. **Probar el flujo en la Preview**
   - Abre la **URL de Preview** (no producción).
   - **Home:** Debe verse la nueva home Rock Legends (logo, PUCÓN ROCK LEGENDS 2026, 3 bloques, selector de Tickets/Estacionamiento/Promo, total, botón «Compra tus tickets»).
   - Elige cantidades (ej. 2 Tickets, 1 Estacionamiento) y haz clic en **«Compra tus tickets»**.
   - Debe ir a **/entradas-rock** con el formulario de datos (nombre, email, teléfono, RUT).
   - Completa el formulario y envía. Debe redirigir a **Mercado Pago**.
   - En MP puedes usar tarjeta de prueba (o cancelar). Si pagas o simulas éxito, debe redirigir a **/success** y desde ahí poder ir a **/mis-entradas** y ver/descargar entradas.
   - Si algo falla (pantalla en blanco, error en formulario, no redirige a MP), anota en qué paso y el mensaje de error para ajustar.

---

### Paso 3 — Documentar la URL de Preview

1. Abre este archivo: `PLAN_ROCK_LEGENDS_2026.md`.
2. Busca la línea que dice **URL de prueba** al inicio (o la sección del checklist donde se pide documentar la URL).
3. Escribe o pega la URL de Preview que copiaste en el Paso 2, por ejemplo:
   - `**URL de Preview (feature/rock-legends):** https://web-oficial-festival-xxx.vercel.app`
4. Guarda el archivo. Así, si el contexto se reinicia o otro desarrollador retoma, sabrá qué URL usar para probar el evento del 20 de febrero.

---

## 1. Objetivo

- Nueva experiencia en www.festivalpucon.cl (cuando se suba a producción): home Rock Legends + compra de tickets para **Viernes 20 de febrero 2026**.
- En rama `feature/rock-legends`: misma URL base (Preview) con todo el flujo listo para probar.

---

## 2. Contenido y producto

- **Título:** PUCÓN ROCK LEGENDS 2026  
- **Subtítulo/tagline:** el día donde los himnos cobran vida  
- **Lugar:** Club de Rodeo de Pucón  
- **Fecha única:** Viernes 20 de febrero 2026 (sin selector de fecha).

**Productos (nombres en BD):**

| Nombre en BD   | Precio  | Límite por compra |
|----------------|---------|--------------------|
| Tickets        | $5.000  | 1–8                |
| Estacionamiento| $3.000  | 0 o 1              |
| Promo          | $8.000  | 0 o 1              |

**Bloques de contenido (colores):**

- **Mística Queen:** Los himnos que detienen el tiempo y la majestuosidad de Freddie Mercury. → **Dorado**
- **Poder Bon Jovi:** La dosis exacta de nostalgia para calentar motores. → **Rojo**
- **Cierre Legendario:** Gabriel Marián detonando la noche con "Ella" y "Mujer Amante". → **Blanco/plata**, bloque **principal** (más grande y destacado).

---

## 3. Flujo

1. **Home (nueva):** Logo + títulos (PUCÓN, 20 DE FEBRERO, PUCÓN ROCK LEGENDS 2026) + lugar + 3 bloques (Queen, Bon Jovi, Gabriel Marián) + selector: Tickets (1–8), Estacionamiento (0/1), Promo (0/1) + total + botón **«Compra tus tickets»**.
2. **Click «Compra tus tickets»** → paso de **datos del comprador** (email, nombre, etc.).
3. **Envío del formulario** → llamadas a **reserve** y **create-preference** (APIs actuales de entradas) con `date=2026-02-20` e ítems según selección → redirección a **Mercado Pago**.
4. **Post-pago:** mismo flujo actual: success → mis-entradas (tickets, PDF).

---

## 4. Base de datos (Supabase)

- **Sin cambiar esquema.** Se reutiliza `event_days` y el evento ya ligado al **20 feb** (o el que corresponda).
- **Pasos:**
  1. Crear 3 `ticket_types`: **Tickets** (price 5000), **Estacionamiento** (3000), **Promo** (8000).
  2. Obtener `event_id` del evento que tiene `event_date = 2026-02-20` (desde `event_days`) y `event_day_id` de ese día.
  3. Crear/actualizar filas en `inventory` (event_id + cada ticket_type_id + total_capacity).
  4. Crear/actualizar filas en `daily_inventory` (event_day_id + cada ticket_type_id + price, nominal_stock, fomo_threshold, overbooking_tolerance).

- **Script:** `scripts/seed-rock-legends.ts` (o equivalente) que ejecute lo anterior. Ejecución manual o `npm run db:seed-rock-legends`.

---

## 5. Código a crear/modificar (rama feature/rock-legends)

| Qué | Dónde | Descripción |
|-----|--------|-------------|
| **Nueva home** | `src/app/page.tsx` | Sustituir por página Rock Legends: logo + títulos + 3 bloques (colores) + selector (Tickets 1–8, Estacionamiento 0/1, Promo 0/1) + total + botón «Compra tus tickets». |
| **Componente home** | `src/components/rock-legends/` (o similar) | Componentes de la home: bloques, selector, total. |
| **Ruta datos + pago** | `src/app/entradas-rock/page.tsx` | Formulario de datos del comprador; al enviar: llamar `/api/entradas/reserve` y `/api/entradas/create-preference` con `date=2026-02-20` e ítems; redirigir a `init_point` de MP. |
| **API inventario Rock** | `src/app/api/entradas-rock/inventory/route.ts` | GET que devuelve inventario solo para `2026-02-20` y solo tipos **Tickets**, **Estacionamiento**, **Promo** (para no depender del filtro de entradas actual). |
| **Home actual (respaldo)** | `src/components/pantalla-inicio/` o ruta alternativa | No borrar: guardar en otra ruta (ej. `/festival` o `/inicio-festival`) para poder recuperar la home anterior si hace falta. Al subir a producción, la home en `/` será Rock Legends; la antigua queda en esa ruta alternativa. |

---

## 6. APIs existentes que se reutilizan

- `POST /api/entradas/reserve` — body: `{ date: '2026-02-20', items: [{ ticket_type_id, quantity }], customer: { email } }`.
- `POST /api/entradas/create-preference` — mismo body; devuelve `init_point` de MP.
- Success, mis-entradas, by-reference, access-token, webhook, process-tickets: **sin cambios**.

---

## 7. Checklist de implementación

- [x] Script de datos: 3 ticket_types, inventory y daily_inventory para 20 feb (`scripts/seed-rock-legends.ts`; `npm run db:seed-rock-legends`).
- [x] GET `/api/entradas-rock/inventory` (solo 2026-02-20, solo Tickets/Estacionamiento/Promo).
- [x] Mover/respaldar home actual a otra ruta: `/festival` (`src/app/festival/page.tsx` → PantallaInicio).
- [x] Nueva home en `src/app/page.tsx` (Rock Legends: logo, títulos, bloques, selector, total, botón) → `RockLegendsHome`.
- [x] Página `src/app/entradas-rock/page.tsx`: formulario comprador + reserve + create-preference + redirect MP.
- [ ] **Pendiente:** Ejecutar `npm run db:seed-rock-legends` en entorno con Supabase (local o Preview) para tener datos.
- [ ] Probar en Preview (rama `feature/rock-legends`): selección → datos → MP → success → mis-entradas.
- [ ] Documentar URL de Preview para pruebas (Vercel → rama `feature/rock-legends` → URL de Preview).

---

## 8. Cuando esté 100%

- Merge de `feature/rock-legends` a `main` (o despliegue a producción según proceso del equipo).
- www.festivalpucon.cl pasará a mostrar home Rock Legends y flujo entradas-rock; la home anterior quedará en la ruta alternativa definida.

---

*Documento creado como punto inicial para continuidad si el contexto se reinicia. Rama: feature/rock-legends.*
