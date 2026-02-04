# Informe técnico: Vercel no crea nuevos deployments tras push a GitHub

## Resumen ejecutivo

Tras hacer `git push origin main` al repositorio conectado al proyecto en Vercel, **no aparece ningún deployment nuevo** en la pestaña Deployments tras varios minutos y refrescos (F5). El último deployment listado sigue siendo antiguo (varias horas) y en estado Error. La producción actual sigue sirviendo una versión antigua (Ready, 7h+), por lo que la URL del sitio y de las APIs no reflejan los últimos commits.

---

## Contexto técnico

### Repositorio y ramas

- **Repositorio GitHub:** `fiestapucon2026-ops/Web_Prueba_04`
- **Rama desde la que se hace push:** `main`
- **Commits recientes pusheados con éxito (confirmado en terminal):**
  - `17da185` — "Módulo tickets QR: worker process-tickets, validate API, job_queue, qr_uuid en orders"
  - `8e6f6ef` — "fix: TicketCard sin react-qr-code/html-to-image para build Vercel"
- **Verificación local:** `git remote -v` apunta a `https://github.com/fiestapucon2026-ops/Web_Prueba_04.git` (fetch y push). El workspace local es la misma base de código que ese repo.

### Proyecto Vercel

- **Plataforma:** Vercel (plan Hobby según capturas).
- **Proyecto:** nombre mostrado en UI: "web_oficial_festival", bajo el equipo/account "Fiesta Pucon's projects".
- **URL de producción:** `https://web-prueba-04.vercel.app`
- **Texto visible en Deployments:** "Automatically created for pushes to `fiestapucon2026-ops/Web_Prueba_04`".
- **Estado observado en Deployments:**
  - La mayoría de los deployments listados están en estado **Error** (build fallido).
  - Solo un deployment antiguo está **Ready** y marcado como "Current" (producción actual).
  - **No aparece ningún deployment** con commit `8e6f6ef` ni `17da185` en la lista, ni siquiera en estado Building o Error, tras esperar ~9 minutos y refrescar varias veces.
  - Tampoco apareció un nuevo registro tras un push con commit vacío (`git commit --allow-empty -m "chore: trigger Vercel deploy"` + `git push origin main`).

### Comportamiento esperado vs observado

- **Esperado:** Cada push a la rama de producción (típicamente `main`) dispara un webhook de GitHub a Vercel y Vercel crea un nuevo deployment (Building → Ready o Error) y lo muestra en Deployments.
- **Observado:** No se crea ningún deployment nuevo; la lista de Deployments no cambia tras pushes confirmados a `main` en `fiestapucon2026-ops/Web_Prueba_04`.

---

## Hipótesis de causa raíz (para verificación por experto)

### 1. Webhook GitHub → Vercel no se dispara o falla

- **Descripción:** La integración Vercel-GitHub se basa en webhooks. Si el webhook no existe, está deshabilitado, o GitHub no puede entregarlo (URL errónea, secret inválido, timeout), Vercel nunca recibe el evento de push.
- **Dónde verificar:**
  - GitHub: `Settings` del repo `Web_Prueba_04` → `Webhooks` → ver si existe un webhook hacia dominio `vercel.com` (o similar) y si hay entregas recientes (deliveries) con código 2xx o errores.
  - Si la conexión es vía **GitHub App** de Vercel: en GitHub, `Settings` → `Applications` → "Vercel" → permisos e instalación en el org/repo; y en Vercel, que el proyecto esté vinculado a ese repo y a la rama correcta.

### 2. Rama de producción en Vercel distinta de `main`

- **Descripción:** Si en Vercel la "Production Branch" está configurada como otra rama (p. ej. `master`, `production`, `release`), los pushes a `main` podrían generar solo Preview deployments (o ninguno, según configuración), y la lista filtrada por "Production" no mostraría nada nuevo.
- **Dónde verificar:** Vercel → proyecto `web_oficial_festival` → `Settings` → `Git` → "Production Branch". Debe coincidir con la rama a la que se hace push (`main`).

### 3. Proyecto Vercel vinculado a otro repo u otra rama

- **Descripción:** Aunque el texto en Deployments diga "pushes to fiestapucon2026-ops/Web_Prueba_04", la conexión real podría ser a otro repo, fork o rama (p. ej. solo a `feature/*`). O el dominio `web-prueba-04.vercel.app` podría estar asignado a otro proyecto.
- **Dónde verificar:** Vercel → proyecto → `Settings` → `Git`: repositorio y rama configurados. Y en `Settings` → `Domains`: qué proyecto tiene asignado `web-prueba-04.vercel.app`.

### 4. Ignore Build Step o condición que salta el build

- **Descripción:** Si en el proyecto hay "Ignore Build Step" configurado (en UI o en script que devuelve exit 0 para "no construir"), Vercel podría aceptar el push pero no crear un deployment que ejecute build, o marcarlo como skipped.
- **Dónde verificar:** Vercel → proyecto → `Settings` → `Git` → "Ignore Build Step". En el repo no hay `vercel.json` con `ignoreBuildStep` ni script obvio que lo implemente; la configuración podría estar solo en la UI de Vercel.

### 5. Límites o estado del plan / cuenta

- **Descripción:** En planes gratuitos puede haber límites de builds o de minutos. Si la cuenta está en límite, en pausa o con facturación en error, Vercel podría dejar de crear nuevos deployments sin un mensaje claro en la lista.
- **Dónde verificar:** Vercel → Account/Team settings → billing, usage, límites; y estado de la cuenta (suspensiones, avisos).

### 6. GitHub App / permisos

- **Descripción:** Si la integración es con la GitHub App de Vercel y la app fue desinstalada, o los permisos se redujeron (p. ej. sin acceso a "contents" o a ese repo), los eventos de push podrían no entregarse a Vercel.
- **Dónde verificar:** GitHub (org o user) → Settings → Applications → Vercel → permisos e instalación para el repo `Web_Prueba_04`.

### 7. Filtros o caché en la UI de Deployments

- **Descripción:** Menos probable, pero la vista Deployments podría estar filtrando por rama, autor o estado y ocultar el deployment nuevo; o haber caché/error de carga.
- **Dónde verificar:** En Deployments, quitar todos los filtros (All Branches, All Authors, etc.), refrescar en modo incógnito o otro navegador, y comprobar si existe un deployment con hash `8e6f6ef` o mensaje "chore: trigger Vercel deploy".

---

## Datos que el experto puede pedir para diagnosticar

1. **Captura o lista de webhooks del repo:** GitHub → `fiestapucon2026-ops/Web_Prueba_04` → Settings → Webhooks: URL, eventos, y últimas deliveries (status code y respuesta).
2. **Configuración Git del proyecto en Vercel:** Rama de producción, repo conectado, "Ignore Build Step" (on/off y comando si existe).
3. **Dominio asignado:** Qué proyecto tiene asignado `web-prueba-04.vercel.app` en Vercel.
4. **Logs de la integración:** Si Vercel ofrece logs de "Deploy Hooks" o de recepción de eventos de Git, comprobar si hay peticiones entrantes tras un push a `main`.
5. **Prueba de Deploy Hook:** Si en Vercel el proyecto tiene "Deploy Hooks", probar un POST al URL del hook y ver si se crea un deployment (para aislar si el fallo es solo GitHub → Vercel o todo el pipeline).

---

## Información de versión y configuración del repo (relevante para cuando el build sí corra)

- **Next.js:** 16.1.4 (Turbopack).
- **Build command:** `npm run build` (definido en `vercel.json` y en `package.json`).
- **Ruta que debe existir tras un build exitoso:** `/api/workers/process-tickets` (GET). Actualmente en producción antigua esa ruta devuelve 404; los últimos commits añaden esa ruta y corrigen el fallo de build por `module-not-found` en `TicketCard.tsx`.

---

## Objetivo final

Que cada push a `main` en `fiestapucon2026-ops/Web_Prueba_04` dispare un nuevo deployment en el proyecto Vercel que sirve `web-prueba-04.vercel.app`, y que la lista Deployments refleje ese nuevo deployment (Building → Ready o Error) para poder tener en producción el worker `/api/workers/process-tickets` y el resto del módulo de tickets QR.

---

*Documento generado para consulta con experto en integración GitHub–Vercel / DevOps. No se ha ejecutado ninguna acción automática en el repo ni en Vercel.*
