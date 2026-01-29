# Ejecutar Opción A — Probar MP en Preview (paso a paso concreto)

Usa este documento en orden. Cada paso indica la URL exacta o la ruta completa en la interfaz.

---

## PARTE 1: Obtener la Preview URL (valor que usarás en todo lo siguiente)

### 1.1 Abrir la lista de deployments en Vercel

1. Abre en el navegador: **https://vercel.com**
2. Inicia sesión si no lo estás.
3. En el dashboard, haz clic en el proyecto. Si tienes varios:
   - El nombre del proyecto puede ser **web_oficial_festival** o **Web_Prueba_04** (el que esté vinculado al repo de GitHub).
   - Si no lo ves en la primera pantalla, haz clic en **"All Projects"** o en el nombre del equipo (ej. **Fiesta Pucon's projects**) y luego en el proyecto.
4. Con el proyecto abierto, en el menú lateral izquierdo haz clic en **"Deployments"**.
   - URL resultante (si tu equipo es "fiesta-pucons-projects" y el proyecto "web_oficial_festival"):  
     **https://vercel.com/fiesta-pucons-projects/web_oficial_festival/deployments**  
   - Si tu URL es distinta, lo importante es estar en la pestaña **Deployments** del proyecto correcto.

### 1.2 Identificar el deployment correcto

En la lista de deployments:

1. Busca una fila donde figure:
   - **Preview** (no "Production")
   - **feature/mercado-pago-payment** (nombre del branch)
   - Estado **Ready** (punto verde).
2. Haz **clic en esa fila completa** (no en un botón). Se abre la página de detalle de ese deployment.

### 1.3 Copiar la URL en la página de detalle

1. En la página de detalle del deployment, busca la sección **"Domains"** (en la misma página donde ves "Status", "Environment", "Source"). Si no la ves, baja con scroll.
2. En **Domains** aparecen una o varias URLs (solo el dominio, sin `https://`). Ejemplo de formato:  
   `weboficialfestival-git-feature-mercado-pago-payment-fiesta-pucons-projects.vercel.app`  
   o similar con otro sufijo.
3. Copia **una** de esas URLs (la primera suele ser la principal). Pégalas en un bloc de notas.
4. Escribe delante **https://** para tener la URL completa. Ejemplo:  
   **https://weboficialfestival-git-feature-mercado-pago-payment-fiesta-pucons-projects.vercel.app**  
   (tu valor será el que viste en Domains; no uses este ejemplo si el tuyo es distinto.)
5. **Guarda esa URL completa** — la llamaremos **[TU_PREVIEW_URL]** en los pasos siguientes.

---

## PARTE 2: Configurar NEXT_PUBLIC_BASE_URL en Vercel

### 2.1 Ir a variables de entorno

1. Sin cerrar Vercel, en el **menú lateral izquierdo** del mismo proyecto haz clic en **"Settings"**.
2. En Settings, en el submenú, haz clic en **"Environment Variables"**.
   - URL típica:  
     **https://vercel.com/fiesta-pucons-projects/web_oficial_festival/settings/environment-variables**

### 2.2 Editar o crear NEXT_PUBLIC_BASE_URL

1. En la lista de variables, busca **NEXT_PUBLIC_BASE_URL**.
2. Si existe: haz clic en los **tres puntos** a la derecha de esa fila → **"Edit"**.  
   Si no existe: haz clic en el botón **"Add Environment Variable"** (o "Add New").
3. En **Key** escribe exactamente: **NEXT_PUBLIC_BASE_URL**
4. En **Value** pega **[TU_PREVIEW_URL]** (la URL completa del paso 1.3, con `https://`).
5. En **Environments** marca al menos **Preview** (para que aplique al deployment del branch). Si quieres que aplique también a Production y Development, marca las tres.
6. Haz clic en **"Save"**.

---

## PARTE 3: Redeploy del deployment Preview

1. En el menú lateral, vuelve a **"Deployments"**.
2. Localiza de nuevo la fila **Preview** + **feature/mercado-pago-payment** (la misma del paso 1.2).
3. Haz clic en esa fila para abrir el detalle.
4. En la esquina superior derecha de la página de detalle, haz clic en los **tres puntos** (⋮) y luego en **"Redeploy"**.
5. En el cuadro de confirmación, deja las opciones por defecto y confirma **"Redeploy"**.
6. Espera a que el estado pase a **Ready** (punto verde).

---

## PARTE 4: Configurar el webhook en Mercado Pago

### 4.1 Abrir la configuración de webhooks

1. Abre en el navegador: **https://www.mercadopago.cl/developers/panel**
2. Inicia sesión.
3. Selecciona la **aplicación** con la que estás probando (la que tiene el MP_ACCESS_TOKEN que usas en Vercel).
4. En el menú de la aplicación, entra en **"Webhooks"** (puede estar en "Configuración" → "Webhooks" o "Your integrations" → "Webhooks", según la versión del panel).

### 4.2 Agregar la URL del webhook

1. Haz clic en **"Agregar URL de webhook"** o **"Add webhook"**.
2. En el campo **URL**, escribe exactamente (sustituye por [TU_PREVIEW_URL] la misma URL del paso 1.3):  
   **[TU_PREVIEW_URL]/api/webhooks/mercadopago**  
   Ejemplo, si tu URL es `https://weboficialfestival-abc123-fiesta-pucons-projects.vercel.app`:  
   **https://weboficialfestival-abc123-fiesta-pucons-projects.vercel.app/api/webhooks/mercadopago**
3. En **Eventos** o **Events**, selecciona **"payment"** (o "Pagos").
4. Guarda. El panel puede mostrar un **Secret** o **Firma**; ese valor debe estar ya configurado en Vercel como **MP_WEBHOOK_SECRET** (si no, añádelo en Environment Variables y redeploy).

---

## PARTE 5: Verificar antes de la prueba de pago

Abre en el navegador estas URLs (sustituye [TU_PREVIEW_URL] por tu URL completa con `https://`):

1. **Diagnóstico de variables:**  
   **[TU_PREVIEW_URL]/api/health**  
   Debe devolver JSON con `"ok": true` y `"missing": []`.

2. **Datos de tickets:**  
   **[TU_PREVIEW_URL]/api/tickets/types**  
   Debe devolver JSON con `ticket_types`, `events` e `inventory`.

3. **Página de compra:**  
   **[TU_PREVIEW_URL]/tickets**  
   Debe cargar el formulario de evento, tipo de ticket y email.

Si las tres funcionan, puedes hacer la prueba de compra con Mercado Pago en **[TU_PREVIEW_URL]/tickets**.

---

## Resumen de la única URL que debes obtener

- La obtienes en: **Vercel → Deployments → clic en la fila Preview (feature/mercado-pago-payment) → sección "Domains"**.
- Es la URL completa (con `https://`) que aparece en Domains.
- Esa misma URL se usa en: **NEXT_PUBLIC_BASE_URL**, en la URL del webhook en Mercado Pago, y para abrir **/api/health**, **/api/tickets/types** y **/tickets**.
