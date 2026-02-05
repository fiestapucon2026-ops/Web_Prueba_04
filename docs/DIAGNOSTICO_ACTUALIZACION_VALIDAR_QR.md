# Diagnóstico: no se actualiza la página /admin/validar-qr en el celular

Si tras borrar caché e historial sigues viendo la versión antigua (p. ej. el lector anterior a qr-scanner), revisar en este orden:

---

## 1. ¿El dominio www.festivalpucon.cl usa el deployment más reciente?

En **Vercel**:

1. Entra al proyecto que tiene asignado el dominio **www.festivalpucon.cl** (Settings → Domains).
2. En **Deployments**, mira el deployment marcado como **Production** (o el que sirve ese dominio).
3. Comprueba el **commit** y la **fecha** de ese deployment. Si la fecha es anterior a cuando subiste el nuevo código (Scanner con qr-scanner), **ese dominio no está sirviendo el build nuevo**.

**Causa habitual:** El dominio www.festivalpucon.cl está ligado a un deployment antiguo, o los pushes van a una rama/repo que no es el que despliega en ese dominio.

**Qué hacer:** Asegurarte de que el proyecto y la rama que despliegan en www.festivalpucon.cl son los que tienen el código actual (p. ej. `main` de Web_Prueba_04). Si hace falta, en Vercel → Deployments → elegir el deployment más reciente (el que tiene tu último commit) → menú (⋮) → **Promote to Production**. Así ese deployment pasa a ser el que responde por el dominio de producción.

---

## 2. Caché en Vercel / CDN

Tras promover el deployment correcto, la primera petición puede seguir siendo antigua si Vercel/CDN cacheó la respuesta.

**Qué hacer:** En Vercel, proyecto → **Settings** → **Functions** (o **Edge**) y revisar si hay caché agresiva. Para `/admin/validar-qr` ya se añadieron cabeceras `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` en `next.config.ts`; tras un nuevo deploy, las respuestas de esa ruta no deberían cachearse.

---

## 3. Comprobar que el deployment incluye el código nuevo

En el deployment que quieres que sea producción:

- Debe existir el archivo **`src/components/Scanner.tsx`** (usa `qr-scanner`).
- En **`src/app/admin/validar-qr/page.tsx`** la primera línea de imports debe ser `import Scanner from '@/components/Scanner';` (no `html5-qrcode`).

Si ese deployment es de un commit que ya tiene esos cambios y lo promueves a Production, www.festivalpucon.cl debería servir la versión nueva.

---

## 4. En el celular, después de un deploy correcto

- Cierra por completo el navegador (quitarlo de recientes).
- Abre de nuevo y entra a **https://www.festivalpucon.cl/admin/validar-qr**.
- Si usas “añadir a pantalla de inicio”, abre la URL desde el icono de la app (o desde el navegador directamente), no desde un acceso antiguo guardado.

---

**Resumen:** Lo más probable es que **www.festivalpucon.cl esté apuntando a un deployment viejo**. Confirmar en Vercel qué deployment es Production para ese dominio y, si hace falta, **Promote to Production** del deployment que tenga el último commit con Scanner + validar-qr refactorizado.
