# Auditoría PROMPT_COMPLETO_LECTOR_VALIDACION_QR.md — Protocolo SENIOR_REASONING_ENGINE_V3

---

## FASE_0: PENSAMIENTO_LATENTE (CoT)

- El prompt describe un entregable acotado (UI de lectura QR) que consume una API existente.
- La precisión técnica depende de: (1) correspondencia exacta con el código (validate route, middleware, auth), (2) ausencia de asunciones imposibles (ej. secret en cliente), (3) especificación clara de cómo se protege la ruta admin.
- Cotejo: middleware actual protege solo `/api/admin/*` con `verifyAdminKeyEdge`; el matcher incluye `/admin/:path*` pero el cuerpo del middleware no aplica auth a rutas que no empiezan por `/api/admin`. Por tanto las páginas `/admin/*` no están protegidas por middleware; la protección la implementa cada página (stock hace fetch a `/api/admin/inventory`, 401 → login).
- La API de validación no escribe `scanned_by`; el prompt lista esa columna como relevante sin aclarar que la implementación actual no la usa.
- Opción A (Bearer secret enviado por la UI): la UI corre en el cliente; un secret "solo en servidor" no puede ser enviado por el navegador sin exponerlo. Por tanto la redacción es lógicamente incorrecta para implementación real.

---

## FASE_1: DECONSTRUCCIÓN_ADVERSARIA

| # | Fallo / punto ciego | Tipo | Verificación cruzada |
|---|----------------------|------|----------------------|
| 1 | **Protección de `/admin/*`:** El prompt afirma "Las páginas bajo `/admin/*` ya están detrás de login admin" pero no especifica que el middleware **no** aplica auth a esas rutas. La protección la hace la página (ej. stock) vía estado `authenticated` y fetch a `/api/admin/*` con `credentials: 'include'`; 401 → formulario de login. Un implementador podría asumir que con poner la ruta en `/admin/validar-qr` ya está protegida. | Asunción débil / punto ciego | `middleware.ts`: `if (path.startsWith('/api/admin'))` → auth solo ahí. `config.matcher` incluye `/admin/:path*` pero no hay branch que exija auth para `path.startsWith('/admin')`. |
| 2 | **Columna `scanned_by`:** Listada en §2.1 como relevante; la ruta `validate/route.ts` no hace UPDATE de `scanned_by`. Indica esquema pero no contrato real de la API. | Imprecisión | `validate/route.ts` líneas 58-64: solo `status`, `scanned_at`, `used_at`. |
| 3 | **Opción A (protección endpoint):** "Exigir header Authorization: Bearer &lt;VALIDADOR_SECRET&gt; ... La UI de admin enviaría ese header (secret en variable de entorno solo en servidor o pasado de forma segura)". En navegador el cliente no puede enviar un secret server-only sin que quede expuesto. La única forma segura es que la UI llame a un proxy bajo `/api/admin/*` que verifique auth admin y ejecute la lógica (o añada el header en llamada server-to-server). | Fallo de arquitectura lógica | Principio: secrets no van al bundle cliente. |
| 4 | **QR con token firmado:** El PDF usa `signTicket(ticketId, ...)` cuando `qr_uuid` no está; la API actual solo acepta UUID. El prompt dice "el QR contiene el qr_uuid cuando existe". No explicita que tickets con QR firmado (sin qr_uuid) quedan fuera del alcance del validador actual. | Punto ciego (scope) | `pdf.tsx` 176-179: `qr_uuid ?? signTicket(...)`. |
| 5 | **Checklist "no modificar":** Incluye "Middleware: solo añadir rutas... no cambiar la protección". No prohíbe explícitamente ampliar el matcher para exigir auth en `/admin/*` (lo cual sería un cambio de comportamiento). Si se desea CIT máximo, conviene aclarar: "no exigir auth en middleware para `/admin/*` a menos que se documente y se alinee con el resto de páginas admin". | Rigor de restricción | Evita que el implementador "arregle" la protección poniendo auth en middleware y rompa el patrón actual (protección por página). |

---

## FASE_2: CUANTIFICACIÓN_CIT

| Métrica | Puntuación | Factores de degradación |
|---------|------------|--------------------------|
| Densidad de información | 82 | Omisión de cómo se protege realmente `/admin/*`; `scanned_by` listado pero no usado; Opción A no implementable tal cual. |
| Precisión terminológica | 90 | "RPC atómica", "service_role", "sold_unused"/"used" correctos; "Bearer &lt;VALIDADOR_SECRET&gt;" mal especificado para cliente. |
| Rigor lógico | 80 | Opción A contradictoria (secret en servidor vs envío desde UI); orden de pasos de la API correcto. |

**CIT inicial: 84**

**Correcciones de alto nivel para CIT > 95:**
1. Especificar que la protección de `/admin/*` es por **patrón de página**: comprobar sesión mediante fetch a un endpoint `/api/admin/*`; si 401, mostrar login (igual que `admin/stock`); no confiar en middleware para auth de páginas.
2. En tabla `tickets`: indicar que `scanned_by` existe en esquema pero la API actual no lo actualiza (o quitarlo de "relevante para este flujo").
3. Reformular Opción A: si se usa secret, la UI **no** debe enviarlo; la UI debe llamar a un proxy (ej. `POST /api/admin/tickets/validate`) que verifique auth admin y ejecute la lógica. Opción B ya es correcta.
4. Añadir una línea de alcance: "Solo tickets cuyo QR es el UUID en claro (`qr_uuid`); tickets con QR firmado quedan fuera del alcance de esta API."
5. En checklist: aclarar que no se debe cambiar el middleware para exigir auth en rutas `/admin/*` (mantener patrón actual).

---

## FASE_3 y FASE_4: RE-INFERENCIA Y CERTIFICACIÓN

**Resultado técnico refinado:** Se generan las correcciones aplicadas en `PROMPT_COMPLETO_LECTOR_VALIDACION_QR.md` (ver sección siguiente). El prompt refinado incorpora las cinco correcciones de ingeniería anteriores.

**CIT alcanzado (post-refinado): 96**

**Justificación:** (1) Protección admin explicitada (patrón por página + fetch + 401 → login). (2) `scanned_by` aclarado como no usado por la API actual. (3) Opción A reemplazada por proxy bajo `/api/admin` (sin secret en cliente). (4) Alcance del validador explícito (solo QR = UUID). (5) Checklist prohíbe cambiar auth en middleware para `/admin/*`. Persiste una pequeña redundancia en el resumen (§7) respecto a §3; impacto en CIT mínimo.

---

## Cambios aplicados al prompt (refinado)

Se aplicaron las siguientes ediciones a `PROMPT_COMPLETO_LECTOR_VALIDACION_QR.md` para alcanzar CIT > 95:

1. **§2.1 Tabla tickets:** Añadido: "(La API actual no escribe `scanned_by`; la columna existe en esquema pero no forma parte del contrato de validación.)"
2. **§2.3 Contenido del QR:** Añadido: "Alcance: solo tickets cuyo QR es el UUID en claro; si el QR contiene un token firmado (fallback cuando no hay `qr_uuid`), esa entrada queda fuera del alcance de esta API."
3. **§2.4 Auth admin:** Añadido: "Importante: el middleware solo aplica verificación de auth a rutas `/api/admin/*`, no a las páginas `/admin/*`. La protección de las páginas admin se hace en cada página: llamada a un endpoint bajo `/api/admin/*` con `credentials: 'include'`; si 401, mostrar formulario de login (como en `src/app/admin/stock/page.tsx`). La nueva pantalla debe seguir el mismo patrón."
4. **§3.2 Opción A:** Sustituida por: "Opción A: La UI **no** debe enviar el secret desde el navegador (no exponer secret en cliente). Crear un proxy bajo `POST /api/admin/tickets/validate` que verifique auth admin (cookie/header existente) y ejecute la lógica de validación (o llame internamente a la misma). Así el endpoint público `/api/tickets/validate` puede quedar deshabilitado o restringido por IP si se desea."
5. **§4 Checklist:** Añadido en "no modificar": "No cambiar el middleware para exigir auth en rutas `/admin/*`; mantener el patrón actual (protección por página vía fetch a `/api/admin/*`)."
