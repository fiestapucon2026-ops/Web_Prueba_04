# Corregir punto 6: redirección desde MP

## Problema

- `NEXT_PUBLIC_BASE_URL` tiene **barra final**:  
  `https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app/`
- El código envía a MP: `back_urls.success = baseUrl + '/success'` → queda  
  `https://...vercel.app//success` (doble barra).
- MP no muestra botón ni cuenta regresiva para volver al sitio.

## Solución 1: Solo configuración (recomendada primero)

1. **Vercel** → tu proyecto → **Settings** → **Environment Variables**.
2. Editar `NEXT_PUBLIC_BASE_URL` en el entorno que uses (Preview / Production).
3. Quitar la barra final:
   - **Valor correcto:**  
     `https://weboficialfestival-git-feature-me-c98662-fiesta-pucons-projects.vercel.app`
   - (Sin `/` al final.)
4. Guardar y **Redeploy** del deployment donde pruebas.
5. Hacer **una nueva compra de prueba**. La preferencia se creará con  
   `back_urls.success = https://...vercel.app/success`  
   y MP debería redirigir o mostrar el enlace para volver.

## Solución 2 (opcional): Código tolerante a barra final

Si quieres que aunque la variable tenga `/` al final la URL siga siendo válida, se puede añadir en **tickets/create-preference** (solo una línea, **con respaldo previo**):

- Después de:  
  `const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';`
- Añadir normalización:  
  `const baseUrlClean = baseUrl.replace(/\/$/, '');`  
  y usar `baseUrlClean` en `back_urls` y `notification_url`.

Eso implica tocar un archivo puente; obligatorio: backup antes y probar de inmediato que Entradas → MP no devuelva 502.

## Compra ya realizada

Para la compra donde te quedaste en la congrats de MP: sin `external_reference` en la URL no hay flujo de token. Puedes:

- Buscar en **Supabase** → tabla `orders` → fila reciente con `status = 'paid'` → copiar `external_reference`.
- Abrir en el navegador:  
  `https://...vercel.app/success?external_reference=UUID&status=approved`  
  (sustituir UUID y la parte de vercel.app por tu URL real).

Así la página `/success` hará polling del token y te llevará a `/mis-entradas`.
