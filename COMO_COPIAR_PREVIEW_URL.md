# Cómo copiar la Preview URL en Vercel (paso a paso)

## Paso 1: Ir a la lista de Deployments

1. Abre: https://vercel.com/fiesta-pucons-projects/web_oficial_festival/deployments
2. Deberías ver la lista de deployments (4w9QN2smi, 6ZuMk9FZq, etc.).

---

## Paso 2: Abrir el deployment de Preview

1. **Haz click en la fila completa** del deployment que dice:
   - **Preview** (no Production)
   - **feature/mercado-pago-payment**
   - **67463f6** (o el commit más reciente)
2. Se abre la página de **detalles** de ese deployment (no una ventana nueva de la app).

---

## Paso 3: Buscar la sección "Domains"

En la página de detalles del deployment:

1. **Baja un poco** (scroll hacia abajo si hace falta).
2. Busca el bloque que dice **"Domains"** (Dominios).
3. Ahí verás **una o dos URLs**, por ejemplo:
   ```
   weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app
   weboficialfestival-3xuklb2le-fiesta-pucons-projects.vercel.app
   ```

---

## Paso 4: Copiar la URL

1. **Haz click en una de las URLs** de la sección Domains (la primera suele ser la principal).
2. Se selecciona; luego **Ctrl+C** (o Cmd+C en Mac) para copiar.
3. **O** haz click con el botón derecho sobre la URL → "Copiar".

La URL completa que debes usar incluye `https://`:

```
https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app
```

(Sustituye por la que veas en tu pantalla si es distinta.)

---

## Paso 5: Verificar la API

Abre en el navegador (o usa la terminal):

**En el navegador:**
```
https://<tu-url-copiada>/api/tickets/types
```

**Ejemplo:**
```
https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app/api/tickets/types
```

Deberías ver un JSON con `ticket_types`, `events` e `inventory`.

**En la terminal:**
```bash
VERIFY_URL=https://<tu-url-copiada> npm run verify:api
```

---

## Resumen visual

```
Lista Deployments  →  Click en fila Preview (feature/mercado-pago-payment)
       ↓
Página de detalles del deployment
       ↓
Buscar sección "Domains"
       ↓
Copiar la URL (ej: weboficialfestival-git-feature-me-xxx.vercel.app)
       ↓
Usar con https:// delante para /api/tickets/types o /tickets
```

---

## Si no ves "Domains"

- La sección **Domains** está en la misma página que "Status", "Environment", "Source".
- A veces hay que hacer **scroll** hacia abajo.
- El botón **"Visit"** (arriba a la derecha) abre esa misma URL en una pestaña nueva; puedes copiar la URL desde la barra de direcciones del navegador al abrirla.
