# Checklist de despliegue (GitHub → Vercel)

Pasos para subir los cambios y que Vercel despliegue. **Ejecutar tú mismo** (no automatizado).

---

## 1. En tu máquina (Ubuntu / terminal)

```bash
# Desde la raíz del proyecto
cd /home/lvc/web_oficial_festival

# Ver qué archivos cambiaron
git status

# Añadir los archivos que quieras subir (ej. todo)
git add .

# Commit con mensaje descriptivo
git commit -m "admin: estado de tickets, ventas/órdenes, guía y docs despliegue/email"

# Subir a GitHub (rama main; si usas otra rama, cambia main)
git push origin main
```

---

## 2. Vercel

- Vercel detecta el push a `main` y lanza un **nuevo build**.
- Revisar en el dashboard de Vercel que el deployment termine en **Ready** (sin errores).
- Si el build falla, revisar los logs en Vercel.

---

## 3. Variables de entorno (Vercel)

Asegurarse de que en el proyecto de Vercel estén configuradas (sobre todo en producción):

- `RESEND_API_KEY` — para que lleguen los emails (ver `docs/EMAIL_NO_LLEGAN.md`).
- `CRON_SECRET` — para que el cron externo pueda llamar a `/api/workers/process-tickets`.
- Resto según `.env.example` (Supabase, Mercado Pago, ADMIN_SECRET, etc.).

---

## 4. Después del despliegue

- Probar las nuevas rutas admin:
  - https://www.festivalpucon.cl/admin/estado-tickets
  - https://www.festivalpucon.cl/admin/ventas
- Si usas cron externo (p. ej. cron-job.org), comprobar que sigue llamando a `GET /api/workers/process-tickets` con `Authorization: Bearer <CRON_SECRET>`.

---

*Documento de referencia. Ajustar rutas o rama si tu flujo es distinto.*
