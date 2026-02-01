# Pasos para que /entradas exista en Vercel (evitar 404)

**Causa del 404:** La ruta `src/app/entradas/` y otras (mis-entradas, base-url, api/entradas, api/orders, etc.) están **solo en tu máquina** (untracked o sin push). Vercel construye desde el **repo remoto**; si no están ahí, no existen en el deployment.

**Objetivo:** Hacer commit y push de todo lo necesario para que el deployment que sirve **web-prueba-04.vercel.app** incluya `/entradas`, `/success`, `/mis-entradas` y las APIs.

---

## Paso 1: Subir el código al remoto (rama actual)

En la raíz del proyecto:

```bash
cd /home/lvc/web_oficial_festival

# Añadir todo lo necesario para entradas + tickets + success + mis-entradas
git add src/app/entradas/
git add src/app/mis-entradas/
git add src/app/success/
git add src/app/api/entradas/
git add src/app/api/orders/
git add src/lib/base-url.ts
git add src/components/TicketCard.tsx
git add src/components/date-selector/
git add src/components/checkout/
git add src/lib/security/
git add src/types/
git add src/middleware.ts
git add src/app/checkout/
git add src/app/admin/
git add src/app/api/admin/
git add src/app/api/tickets/
git add src/lib/admin-auth-edge.ts
git add src/lib/admin-auth.ts
git add src/lib/admin-session-edge.ts
git add src/lib/admin-session.ts
git add src/lib/rut.ts
git add supabase/
git add scripts/verify-tickets-qr.js
git add docs/

# Ver qué quedará en el commit
git status

# Commit
git commit -m "feat: entradas, mis-entradas, BASE desde request, tickets QR, admin"

# Push de la rama actual (feature/mercado-pago-payment)
git push origin feature/mercado-pago-payment
```

---

## Paso 2: Qué dominio usa cada rama en Vercel

- **Production** (en tu caso suele ser **main**) → dominio tipo **web-prueba-04.vercel.app** o **www.festivalpucon.cl**.
- **Preview** por rama → URL tipo **weboficialfestival-git-feature-mercado-pago-payment-xxx.vercel.app**.

Si **web-prueba-04.vercel.app** está asociado a **Production (main)**:

- El código que ves en 404 es el de **main**.
- Lo que acabas de subir está en **feature/mercado-pago-payment**.
- Para que **web-prueba-04.vercel.app** tenga `/entradas` tienes que **llevar ese código a main**:

```bash
git checkout main
git pull origin main
git merge feature/mercado-pago-payment
git push origin main
```

Luego en Vercel se dispara un nuevo deploy de Production; cuando termine, **https://web-prueba-04.vercel.app/entradas** debería dejar de dar 404.

Si **web-prueba-04.vercel.app** es un **Preview** de la rama **feature/mercado-pago-payment**:

- Con solo el **Paso 1** (push de feature/mercado-pago-payment) Vercel despliega esa rama.
- En el dashboard de Vercel, en **Deployments**, abre el último deploy de esa rama y usa la URL que te den (puede ser web-prueba-04 o otra). Esa URL ya debería tener `/entradas`.

---

## Paso 3: Comprobar en Vercel

1. Vercel → **Deployments**.
2. Ver si el último deploy es de **main** o de **feature/mercado-pago-payment**.
3. Ver qué **dominio** tiene ese deploy (Visit / Production / Preview).
4. Si web-prueba-04 es **main** y tú pusheaste solo a **feature**, haz el merge a **main** (comandos del Paso 2) y espera al nuevo deploy.

---

## Resumen

| Situación | Qué hacer |
|-----------|-----------|
| Código nunca subido | Paso 1: `git add` + `commit` + `push` en tu rama. |
| web-prueba-04 = Production (main) | Paso 2: merge de feature en main y `push origin main`. |
| web-prueba-04 = Preview de feature | Tras Paso 1, usar la URL de Preview que muestre Vercel para esa rama. |

El 404 se resuelve cuando el deployment que responde por **web-prueba-04.vercel.app** se construye con un repo que **sí contiene** `src/app/entradas/` (y lo demás). Eso solo pasa después de commit + push y, si aplica, merge a main.
