# Pasos: push manual y prueba del flujo

## 1. Push manual (desde tu máquina)

Abre una terminal en la raíz del proyecto (`web_oficial_festival`).

### 1.1 Añadir archivos al commit

```bash
# Incluir todo lo del flujo pago on-site + instrucciones
git add .env.example \
  INSTRUCCIONES_PARA_SIGUIENTE_CHAT_FINAL.md \
  INSTRUCCIONES_PARA_SIGUIENTE_CHAT_2026_02_05.md \
  docs/MERCADOPAGO_PAGO_SIN_CUENTA_ANDROID.md \
  docs/MIGRACION_PAGO_ONSITE_ANALISIS_Y_PLAN.md \
  package.json package-lock.json \
  src/app/admin/validar-qr/page.tsx \
  src/app/entradas/page.tsx \
  src/app/tickets/page.tsx \
  src/app/pago/ \
  src/app/api/entradas/reserve/ \
  src/app/api/orders/create-payment/ \
  src/app/api/orders/payment-data/ \
  src/app/api/tickets/reserve/ \
  src/lib/security/payment-data-token.ts
```

Si prefieres subir **todo** (incluye respaldos y docs extra):

```bash
git add -A
```

### 1.2 Crear commit

```bash
git commit -m "feat: flujo pago on-site (Bricks) + instrucciones traspaso"
```

### 1.3 Enviar a GitHub (dispara el deploy en Vercel)

```bash
git push origin main
```

- Repo: `fiestapucon2026-ops/Web_Prueba_04`
- Rama: `main`
- Vercel creará un **nuevo deployment** automáticamente al detectar el push.

### 1.4 Comprobar en Vercel

1. Entra a [Vercel](https://vercel.com) → proyecto → **Deployments**.
2. Debe aparecer un deployment nuevo (Building → Ready).
3. Si añadiste **variables de entorno** (`NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_PAYMENT_DATA_SECRET`) y no estaban antes, ya las usará este build.

---

## 2. Probar todo

Cuando el deployment esté **Ready**:

### 2.1 Variables de pago on-site

- En Vercel: **Settings → Environment Variables**.
- Confirmar que existan:
  - `NEXT_PUBLIC_MP_PUBLIC_KEY` (valor de producción)
  - `MP_PAYMENT_DATA_SECRET`
- Si las acabas de crear o cambiar: **Redeploy** del último deployment (menú ⋮ → Redeploy) para que el build las tome.

### 2.2 Prueba rápida del flujo

1. **Entradas:** Ir a `/entradas` → elegir fecha/cantidad → continuar.
   - Si está `NEXT_PUBLIC_MP_PUBLIC_KEY`: debe ir a **`/pago`** y mostrar el Brick de tarjeta.
   - Si no: va a Checkout Pro (redirección a Mercado Pago).

2. **Pago en `/pago`:**
   - Completar datos de tarjeta (usar [tarjetas de prueba MP](https://www.mercadopago.cl/developers/es/docs/checkout-bricks/additional-content/test-cards)).
   - Confirmar que al aprobar redirige a **success** (o pending/failure según el caso).

3. **Post-pago:**
   - En **success**: ver/descargar entrada (PDF).
   - En **Mis entradas**: que la compra aparezca y el PDF se pueda descargar.

4. **Tickets:** Repetir flujo desde `/tickets` y verificar que también use `/pago` cuando la variable esté definida.

### 2.3 Prueba en Android (objetivo del cambio)

- En un dispositivo Android, repetir compra por **Entradas** o **Tickets**.
- Objetivo: que **no** obligue a pagar con cuenta Mercado Pago; que permita pago con tarjeta en la web (Brick).

---

## 3. Si algo falla

- **Sigue yendo a Checkout Pro:** Revisar que `NEXT_PUBLIC_MP_PUBLIC_KEY` esté en Vercel y que hayas hecho **Redeploy** después de añadirla.
- **Error en `/pago` o en el pago:** Revisar consola del navegador y logs en Vercel (Functions / Logs).
- **Rollback:** En Vercel, borrar o vaciar `NEXT_PUBLIC_MP_PUBLIC_KEY` y hacer Redeploy; el sitio volverá a usar solo Checkout Pro.
