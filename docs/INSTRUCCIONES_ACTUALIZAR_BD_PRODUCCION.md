# Instrucciones: actualizar base de datos a producción (Ubuntu)

Actualiza tipos de entrada, fechas, stock, precios, FOMO y sobreventa para Festival Pucón 2026 (Club de Rodeo de Pucón).

---

## 1. Requisitos

- Node.js y npm instalados (ya los usas en el proyecto).
- Archivo **`.env.local`** en la raíz del proyecto con las mismas variables que usas para desarrollo (o para Vercel): `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Comprobar que tienes las variables

El script lee **`.env.local`** (y si no existe, **`.env`**). Debe haber:

- **SUPABASE_URL** — URL de tu proyecto Supabase (Supabase → Project Settings → API → Project URL).
- **SUPABASE_SERVICE_ROLE_KEY** — Clave `service_role` (Project API keys). No la subas a Git.

Si ya usas `npm run dev` o tienes configurado Vercel con esas variables, copia los valores a `.env.local` en tu máquina (o usa el mismo `.env.local` que ya tengas).

---

## 3. Comandos en la terminal (Ubuntu)

Desde la raíz del proyecto:

```bash
cd /home/lvc/web_oficial_festival
npm run db:update-production
```

No hace falta escribir la URL ni la clave en la terminal: el script usa las de `.env.local`.

---

## 4. Qué hace el script

- **Tipos de entrada:** Asegura que existan (y actualiza precio base): Familiar (0), Todo el día (5000), Estacionamiento Familiar (5000), Estacionamiento Todo el día (8000).
- **Eventos y días:** Crea o reutiliza 12 fechas (06/feb–01/mar 2026) y los vincula al evento “Festival Pucón 2026” y recinto “Club de Rodeo de Pucón”.
- **Inventario diario:** Stock y precio por día y tipo; FOMO 99 % en todos los días y **100 % el 28/feb** (para que “Últimas unidades” salte de inmediato ese día); sobreventa 10 %.
- **Inventario (capacidad):** Actualiza la tabla `inventory` con la capacidad total (stock nominal + 10 %).

---

## 5. Salida esperada

Algo como:

```
Tipos de entrada...
  OK: 4 tipos
Eventos...
  OK: 12 eventos
Días de evento...
  OK: 12 días
Inventario diario...
  OK: 48 filas
Inventario (capacidad total)...
  OK: 48 filas

Listo. FOMO 99% (28/feb 100%), Sobreventa 10%, Recinto: Club de Rodeo de Pucón
```

Si falta `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`, el script dirá: *"Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Configúralas en .env.local (mismo archivo que para npm run dev)."*

---

## 6. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` solo en tu máquina (`.env.local` está en `.gitignore`). No la subas a Git ni la pongas en el front.
