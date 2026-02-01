# Solución multi-dominio en Vercel (BASE dinámico)

**Problema:** Un mismo deployment en Vercel puede servir varios dominios (ej. `www.festivalpucon.cl` y `web-prueba-04.vercel.app`). La variable `NEXT_PUBLIC_BASE_URL` se embebe en build y es única por entorno (Production/Preview); no puede tener un valor distinto por dominio con un solo build.

**Solución adoptada:** Obtener la BASE (origen) desde el **request** que crea la preferencia, usando los headers que Vercel y el proxy inyectan (`x-forwarded-host`, `x-forwarded-proto` o `host`). Así, quien abre `https://web-prueba-04.vercel.app/entradas` genera preferencias con `back_urls` y `notification_url` con ese mismo dominio; quien abre `https://www.festivalpucon.cl/entradas` genera preferencias con ese dominio. Un solo deployment, varios dominios, sin conflicto.

---

## Procedimiento técnico

1. **Helper `getBaseUrlFromRequest(request: Request, fallback: string): string`** (en `src/lib/base-url.ts`):
   - Lee `x-forwarded-host` o `host` y `x-forwarded-proto` (o `https` por defecto).
   - Construye `origin = protocol + '://' + host`, normaliza (trim, quitar barra final) y devuelve; si no hay host, devuelve fallback normalizado.

2. **Uso en create-preference:**
   - **tickets/create-preference:** Reemplazar `baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '...'` por `baseUrl = getBaseUrlFromRequest(request, process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl')`. Usar esa `baseUrl` en `back_urls` y `notification_url`.
   - **entradas/create-preference (rama 1 ítem):** Usar la misma función para la BASE con la que se llama a `fetch(baseUrl + '/api/tickets/create-preference')`, para que la llamada interna vaya al mismo host y tickets reciba el mismo Host en su request.
   - **entradas/create-preference (rama multi-ítem):** Usar la misma función para construir `back_urls` y `notification_url`.

3. **Vercel:** No es necesario definir `NEXT_PUBLIC_BASE_URL` distinta por dominio; queda como fallback cuando el request no trae host (ej. llamadas server-to-server sin Host). Para E2E desde `web-prueba-04.vercel.app` o desde `www.festivalpucon.cl`, el dominio se obtiene del request.

4. **Regla de oro:** Antes de modificar `entradas/create-preference` o `tickets/create-preference`, crear respaldo en `respaldo_pre_tickets_qr/`. Un solo cambio lógico: añadir uso de `getBaseUrlFromRequest` y normalización.

---

## Alternativa (solo configuración, sin código)

Si se prefiere no tocar create-preference: usar **dos deployments** en Vercel — uno para Production (dominio `www.festivalpucon.cl`) con `NEXT_PUBLIC_BASE_URL = https://www.festivalpucon.cl`, y otro para Preview (dominio `web-prueba-04.vercel.app`) con `NEXT_PUBLIC_BASE_URL = https://web-prueba-04.vercel.app`. Así cada dominio tiene su propio build y su propia variable. El inconveniente: si en Production se asocian ambos dominios al mismo deployment, esta alternativa no aplica; por tanto la solución adoptada es BASE desde el request.
