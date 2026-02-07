# Revisión conjunta: subir cambios /entradas (sin VIP, sin Promo) a Vercel

**Objetivo:** Que www.festivalpucon.cl/entradas muestre solo los 4 tipos de producción (Familiar, Todo el día, Estacionamiento Familiar, Estacionamiento Todo el día) y deje de mostrar VIP y Promo.

---

## Estado actual

- **Rama local:** `main` (sincronizada con `origin/main`).
- **Remoto:** `https://github.com/fiestapucon2026-ops/Web_Prueba_04.git`.
- **Producción:** Vercel despliega desde este repo; dominio producción = www.festivalpucon.cl (o web-prueba-04.vercel.app según configuración).

---

## Archivos a subir (cambios de la solución)

| Archivo | Qué hace |
|---------|----------|
| `src/app/api/entradas/inventory/route.ts` | Filtra inventario: solo devuelve los 4 tipos de producción. |
| `src/components/checkout/TicketSelector.tsx` | Muestra solo esos 4 tipos; sin VIP, sin Promo. |
| `scripts/update-production-inventory.ts` | Script ya ejecutado en BD; incluirlo en repo para futuras actualizaciones. |
| `docs/INSTRUCCIONES_ACTUALIZAR_BD_PRODUCCION.md` | Instrucciones para correr el script. |
| `package.json` / `package-lock.json` | Script `db:update-production` y dependencia `dotenv`. |

---

## Pasos para desplegar

### 1. Añadir y commitear

```bash
cd /home/lvc/web_oficial_festival

git add src/app/api/entradas/inventory/route.ts
git add src/components/checkout/TicketSelector.tsx
git add scripts/update-production-inventory.ts
git add docs/INSTRUCCIONES_ACTUALIZAR_BD_PRODUCCION.md
git add package.json package-lock.json

git status   # revisar que solo esté lo deseado

git commit -m "fix(entradas): solo 4 tipos producción; filtro API y selector sin VIP/Promo"
```

### 2. Push a main

```bash
git push origin main
```

### 3. En Vercel

1. Ir a [vercel.com](https://vercel.com) → proyecto (web_oficial_festival / Web_Prueba_04).
2. **Deployments:** en 1–2 min debería aparecer un deployment nuevo con el último commit (Building → Ready).
3. Si **Production Branch** es `main`, ese deployment pasará a ser producción y www.festivalpucon.cl se actualizará.
4. Probar en ventana privada: https://www.festivalpucon.cl/entradas → elegir una fecha → deben verse solo **Familiar**, **Todo el día**, **Estacionamiento** (Familiar y Todo el día), **Sin vehículo**, y **no** VIP ni Promo.

---

## Si no se crea un deployment nuevo

- Revisar **GitHub → repo → Settings → Webhooks:** que exista el webhook de Vercel y que las entregas recientes sean 2xx.
- En **Vercel → Project Settings → Git:** confirmar que la rama de producción sea `main` (o la que uses).
- Probar **Redeploy** manual: Vercel → Deployments → último deploy → tres puntos → Redeploy.

---

## Resumen

| Paso | Acción |
|------|--------|
| 1 | `git add` de los archivos listados + `git commit` |
| 2 | `git push origin main` |
| 3 | Esperar deploy en Vercel y probar /entradas en producción |
