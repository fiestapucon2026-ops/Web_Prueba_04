# Análisis crítico del informe del experto sobre AUDITORIA_SEGURIDAD_OWASP_2026-02.md

**Objetivo:** Contrastar el informe del experto con el código real, corregir matices, y fijar conclusiones ejecutables.  
**Sin ejecutar cambios de código.**

---

## 1. Valoración global del informe del experto

- **92/100 y “sorprendentemente preciso”:** Coincido. Los hallazgos críticos (RLS, carrera, IDOR, rate limit en memoria) son correctos y no son alucinaciones.
- **Orden de ejecución (RLS → atomicidad → rate limit):** Acertado. RLS y atomicidad son “business killers”; el rate limit en memoria es un falso sentido de seguridad.

---

## 2. Puntos donde el experto acierta y matiza bien

### 2.1 RLS (“Coladero de datos”)

- **Experto:** Correcto y catastrófico; solución “incompleta”: anon podría necesitar SELECT en `inventory` para el frontend.
- **Contraste con el código:** En este proyecto **no hay uso de Supabase desde el cliente**. El frontend obtiene inventario y tipos de ticket vía **API** (`/api/entradas/inventory`, `/api/tickets/types`), y esas rutas usan `requireSupabaseAdmin()`. No existe `createClient(anon)` en ningún `.tsx`.
- **Conclusión:** Para **esta** arquitectura, la solución “solo `service_role`” en `orders`, `inventory` y `job_queue` **sí es suficiente**. No hace falta política SELECT para `anon` en `inventory`. Si en el futuro se expusiera Supabase desde el cliente, habría que revisar.

### 2.2 Condición de carrera (overselling)

- **Experto:** Correcto; prefiere `UPDATE ... RETURNING` frente a “transacción + SELECT FOR UPDATE” en serverless por connection pool.
- **Conclusión:** Aceptado. La recomendación de atomicidad vía UPDATE (o RPC que decremente y devuelva) es la adecuada para Vercel.

### 2.3 IDOR en access-token

- **Experto:** Válido pero matizable; UUID v4 no es adivinable; el riesgo es filtración (logs, URLs, links compartidos). Propone JWT firmado con expiración 24h en lugar de “sesión/cookie”.
- **Conclusión:** De acuerdo. El IDOR es real por filtración/uso indebido del link, no por fuerza bruta. La contrapropuesta (link con JWT firmado, corta vida) es más realista que “sesión/cookie” en un entorno stateless.

### 2.4 Rate limit en memoria

- **Experto:** “Precisión quirúrgica”; en serverless el Map es por instancia, inútil ante muchas lambdas.
- **Conclusión:** Correcto. El hallazgo y la crítica son válidos.

---

## 3. Falsos positivos / exageraciones: correcciones

### 3.1 Timing attack sobre CRON_SECRET

- **Experto:** Teórico vs práctico; jitter de red hace la explotación muy difícil; aun así usar `crypto.timingSafeEqual` (coste cero).
- **Conclusión:** De acuerdo. Mantener el hallazgo como **Alta** en el informe puede ser excesivo; **Media** sería más justo. La mitigación sigue siendo correcta y barata.

### 3.2 Payload de prueba MP

- **Experto:** Si el bypass (id 123456) está antes de lógica de negocio y acceso a BD, riesgo nulo.
- **Contraste con el código:** El return 200 del payload de prueba está **después** de `request.json()` y `WebhookBodySchema.safeParse`, y **antes** de `verifyMercadoPagoSignature` y de cualquier acceso a Supabase/MP. No se toca BD ni se modifican datos.
- **Conclusión:** El experto tiene razón: **riesgo nulo** en la implementación actual. Puede bajarse a **informativo** o quitarse de “vulnerabilidad” y dejar solo una nota de hardening (p. ej. restringir por IP de MP si se conoce).

---

## 4. “Lo que Cursor no vio”: verificación en código

### 4.1 Validación de tipos en runtime (Zod) en el webhook

- **Experto:** ¿Qué pasa si MP envía JSON malformado? Si no usas Zod, la app podría crashear antes de verificar la firma (DoS).
- **Contraste con el código:** En `webhooks/mercadopago/route.ts` se usa **Zod**: `WebhookBodySchema.safeParse(rawBody)` (L114). Si falla, se responde 200 y no se procesa. No se accede a BD antes del parse.
- **Conclusión:** **No es un punto ciego.** El webhook ya valida el body con Zod antes de lógica de negocio. El experto asumió que no estaba; en este proyecto sí está.

### 4.2 Manejo de decimales (floating point)

- **Experto:** Dinero en float/number puede dar errores de redondeo; usar numeric/decimal en BD y enteros o librería en JS.
- **Contraste con el código:** En las rutas de preferencia y órdenes se usa `Math.round(unitPriceRaw)`, `unitPrice` entero, `amount = unitPrice * quantity`. Los montos se manejan como enteros (CLP). En la RPC de admin se usa `v_over::numeric` y `FLOOR(...)`. No aparece `float` para montos en las rutas revisadas.
- **Conclusión:** El riesgo que señala el experto es genérico y válido; en **este** código el manejo monetario es en enteros. Queda pendiente **confirmar en el esquema de BD** que `price`/`amount` sean `integer` o `numeric` (no `real`/`double precision`). Si ya lo son, este “punto ciego” está cubierto en la práctica.

### 4.3 Logs de auditoría

- **Experto:** No se menciona si se guardan logs de intentos fallidos de firma o errores de stock; sin observabilidad no se detectan ataques a tiempo.
- **Contraste con el código:** Hay `console.error`/`console.warn` (firma inválida, stock insuficiente, etc.) pero **no** persistencia en tabla ni en servicio de logs. En Vercel los logs son efímeros.
- **Conclusión:** **Punto ciego real.** No existe una capa de auditoría persistente (tabla `audit_log` o integración con un log store). Es una mejora válida para detectar intentos de abuso o firma inválida de forma retrospectiva.

---

## 5. Resumen de correcciones al informe del experto

| Tema | Experto dice | Realidad en este repo |
|------|--------------|------------------------|
| RLS + anon SELECT en inventory | Solución incompleta; anon podría necesitar SELECT para frontend | Frontend no usa Supabase; todo pasa por API con admin. Política solo service_role es suficiente. |
| Zod en webhook | “¿Qué pasa si no usas Zod?” (punto ciego) | Zod ya se usa; body validado antes de firma y BD. No es punto ciego. |
| Payload prueba MP | Si bypass está antes de lógica, riesgo nulo | Confirmado: return 200 antes de firma y BD. Riesgo nulo. |
| Decimales / dinero | Verificar float vs numeric/enteros | Código usa enteros y Math.round; falta confirmar tipo de columna en BD. |
| Logs de auditoría | No mencionado; punto ciego | Correcto: no hay auditoría persistente; solo console.*. |

---

## 6. Conclusiones finales

1. **La auditoría OWASP (Cursor) es sólida** para RLS, carrera, IDOR, rate limit y cron. El informe del experto la refuerza y prioriza bien (92/100 es razonable).

2. **El experto matiza bien** en IDOR (UUID + filtración), timing attack (teórico) y payload de prueba MP (riesgo nulo). Esas matizaciones son correctas y útiles para no sobreactuar.

3. **Correcciones importantes al experto:**
   - En **esta** arquitectura no hace falta SELECT para anon en inventory; el frontend no usa Supabase directo.
   - **Sí** se usa Zod en el webhook; no es un punto ciego.
   - El payload de prueba MP está correctamente acotado (antes de firma y BD).

4. **Punto ciego real no cubierto por Cursor:** ausencia de **auditoría persistente** (intentos fallidos de firma, errores de stock, accesos a access-token/by-reference). Es una mejora de observabilidad y detección de abusos.

5. **Orden de acción recomendado (sin cambiar código aquí):**
   - **P0:** RLS en `orders`, `inventory`, `job_queue` (solo service_role).
   - **P0:** Atomicidad de venta (UPDATE/RPC en BD).
   - **P1:** Rate limit externo (Upstash/Redis o equivalente) o asumir que no hay rate limit hasta implementarlo.
   - **P1:** IDOR: diseño de token/link firmado (ej. JWT 24h) para “Mis entradas”.
   - **P2:** Timing-safe en cron (bajo coste, buena práctica).
   - **P2:** Auditoría persistente de fallos de firma y eventos sensibles.

Con estos ajustes, el informe del experto y la auditoría original quedan alineados con el código real y listos para guiar la implementación sin falsos positivos exagerados ni puntos ciegos incorrectos.
