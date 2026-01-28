# Cómo Obtener la Preview URL de Vercel

## ⚠️ Importante

**GitHub** = Repositorio de código (lo que acabas de ver)  
**Vercel** = Deployment en vivo (donde está la aplicación funcionando)

Para verificar la API, necesitas la **Preview URL de Vercel**, no la URL de GitHub.

---

## Paso 1: Acceder a Vercel

1. Ir a: https://vercel.com
2. Iniciar sesión (con la misma cuenta que está conectada a GitHub)
3. Buscar el proyecto: `Web_Prueba_04` o `web-prueba-04`

---

## Paso 2: Encontrar el Deployment

### Opción A: Desde la página del proyecto

1. Click en el proyecto
2. Ir a la pestaña **Deployments**
3. Buscar el deployment más reciente del branch `feature/mercado-pago-payment`
4. Deberías ver algo como:
   ```
   feature/mercado-pago-payment
   Commit: bfbea93 - docs: agregar resumen...
   Status: ✅ Ready (o Building)
   Preview: https://feature-mercado-pago-payment-xxx.vercel.app
   ```

### Opción B: Desde el sidebar de GitHub

Según la información que veo, en GitHub hay un sidebar que muestra:
- **Deployments: 14 total**
- **Preview 10 minutes ago** ✅

1. En GitHub, en el sidebar derecho, buscar "Deployments"
2. Click en "14 deployments" o "Preview 10 minutes ago"
3. Esto te llevará a Vercel donde verás la Preview URL

---

## Paso 3: Copiar la Preview URL

La URL tendrá un formato como:
```
https://feature-mercado-pago-payment-abc123xyz.vercel.app
```

**Esta es la URL que necesitas para:**
- Verificar la API
- Configurar el webhook en Mercado Pago
- Probar el flujo completo

---

## Paso 4: Verificar que Funciona

Una vez que tengas la Preview URL:

1. Abrir navegador
2. Ir a: `https://<tu-preview-url>/api/tickets/types`
3. **Deberías ver JSON** con eventos y tickets

**Si ves JSON → ✅ API funciona**  
**Si ves error → Revisar variables de entorno en Vercel**

---

## Si No Aparece el Deployment

### Posibles causas:

1. **Vercel no detectó el branch automáticamente**
   - Solución: Ir a Vercel → Settings → Git → Verificar conexión

2. **El build está en progreso**
   - Solución: Esperar unos minutos y refrescar

3. **El build falló**
   - Solución: Revisar logs en Vercel para ver el error

### Forzar Deployment Manual:

1. En Vercel, ir a: **Deployments**
2. Click en **"Create Deployment"** o **"Deploy"**
3. Seleccionar branch: `feature/mercado-pago-payment`
4. Click en **Deploy**

---

## Verificación Rápida

**URL correcta para verificar API:**
```
https://<preview-url-de-vercel>/api/tickets/types
```

**NO es:**
```
https://github.com/.../tree/feature/mercado-pago-payment
```

---

## Próximo Paso

Una vez que tengas la Preview URL y verifiques que la API funciona:

1. Configurar variables de entorno en Vercel (si aún no lo hiciste)
2. Configurar webhook en Mercado Pago
3. Hacer primera prueba completa

**Ver:** `PASOS_FINALES_VERCEL.md` para los pasos completos.
