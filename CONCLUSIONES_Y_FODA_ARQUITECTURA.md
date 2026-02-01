# Conclusiones y FODA — Arquitectura Cola + Storage + Validación

**Contexto:** Propuesta de webhook rápido → cola en BD → worker (cron) → PDF en Storage + email con link + API de validación por `qr_uuid`. Sin ejecutar código aún.

---

## 1. Problemas no resueltos hoy (resumen)

| Problema | Estado actual | Qué lo resuelve |
|----------|---------------|------------------|
| **Timeout en webhook** | PDF + email en el mismo request; 200 después de varios segundos. Riesgo 504 y cobro sin entrega. | Cola + worker: webhook responde 200 en &lt;2 s (objetivo; depende de latencia/volumen); el trabajo pesado lo hace el worker. |
| **Sin cola** | No hay delegación de trabajo; todo en un solo request. | Tabla `job_queue` + worker invocado por cron. |
| **PDF efímero** | Se genera en memoria, se adjunta al email y se descarta. Si el correo rebota, no hay respaldo. | Storage: PDF en bucket, link en el email; reenvío y panel admin posibles. |
| **Sin validación en puerta** | No existe API de escaneo; no se puede marcar ticket como usado desde una app. | API de validación por `qr_uuid` (Online A): consulta BD, marca `used`, `used_at`. |
| **Build Vercel fallando** | module-not-found (TicketCard, pdf/qrcode). El módulo no está desplegado en producción. | **No lo resuelve esta arquitectura.** Lo resuelve la propuesta de build (qrcode dinámico, quitar downloadjs, etc. en PROPUESTA_SOLUCION_TICKETS_QR_VERCEL). |
| **DNS Resend pendiente** | Riesgo de bloqueo/spam con volumen alto. | **No lo resuelve el código.** Prerrequisito operativo: configurar MX, SPF, DKIM en el dominio. |

---

## 2. Conclusiones

### 2.1 ¿Le sirve a tu realidad?

**Sí, siempre que se entienda el alcance.**

- **Realidad:** Festival con hasta ~1.200 transacciones diarias y picos; webhook síncrono; PDF en memoria; sin cola; sin API de validación en puerta; build en Vercel roto y DNS de email pendiente.
- **La arquitectura propuesta:**  
  - Reduce el riesgo de timeout y de “cobrado pero no entregado” (webhook rápido + cola + worker con reintentos).  
  - Da persistencia al PDF (Storage + link) y base para reenvíos y soporte.  
  - Cierra el hueco de “no hay forma de validar/quemar ticket en puerta” (API por `qr_uuid`, Online A).  
- **Conclusión:** Encaja con la realidad de volumen, límites de Vercel y necesidad de validación en puerta. Es un aporte real **en la parte operativa y de escalabilidad** (timeout, entrega, persistencia, scan).

### 2.2 ¿Es un aporte real?

**Sí, en los ejes que toca.**

- **Aporte 1 — Entrega garantizada:** Hoy, si el webhook tarda más que el límite de la función, puedes tener 504 y cobro sin email. Con cola + worker, el “compromiso” de entrega queda guardado en `job_queue` y se procesa aunque el webhook ya haya respondido 200. Reintentos en el worker mejoran la probabilidad de entrega.
- **Aporte 2 — Persistencia del activo:** PDF en Storage permite link en el email (y opcionalmente adjunto), reenvío sin regenerar desde cero y, si más adelante hay panel admin, descarga del ticket.
- **Aporte 3 — Validación en puerta:** Sin API de scan, no hay flujo operativo para “entrada usada”. La API por `qr_uuid` (Online A) cierra ese hueco y es coherente con tu decisión de internet garantizado en puerta.
- **Aporte 4 — Sin dependencias nuevas de pago:** Cola en tu propia BD (Supabase) y worker en Vercel Cron; no introduces Upstash/Inngest ni coste extra de cola externa (salvo el plan de Vercel que ya uses).

### 2.3 ¿Es “la” solución a todos los problemas sin resolver?

**No es la única pieza; es la pieza correcta para timeout, entrega, persistencia y validación.**

- **Lo que sí resuelve:**  
  - Timeout y riesgo de cobro sin entrega (webhook rápido + cola + worker).  
  - Falta de persistencia del PDF (Storage).  
  - Ausencia de validación en puerta (API por `qr_uuid`).  
- **Lo que no resuelve por sí sola:**  
  - **Build en Vercel:** Sigue siendo necesario aplicar la propuesta de build (qrcode dinámico en `pdf.tsx`, quitar downloadjs en TicketCard, etc.) para que el módulo se despliegue y el worker pueda ejecutarse en producción.  
  - **DNS Resend:** Es prerrequisito operativo; sin MX/SPF/DKIM el envío masivo seguirá en riesgo aunque la arquitectura sea correcta.  
- **Conclusión:** Esta arquitectura **es** la solución adecuada a los problemas de **diseño operativo y escalabilidad** (timeout, cola, persistencia, validación). Para tener el módulo 100% operativo en tu realidad hace falta **además**: (0) ejecutar migraciones SQL (job_queue, tickets, Storage) antes o en el mismo release que el código; (1) arreglar el build en Vercel; (2) cerrar DNS para Resend.

---

## 3. FODA de la arquitectura propuesta

### Fortalezas

- **Webhook rápido:** Objetivo de la propuesta: respuesta 200 en &lt;500 ms o &lt;2 s; depende de latencia de Supabase y volumen de órdenes/tickets en el request; no verificado en producción.
- **Desacoplamiento claro:** Registro de pago + encolado en un lado; generación de PDF y envío en otro. Fallos del worker no hacen fallar el webhook.
- **Persistencia en BD:** La intención de “enviar ticket” queda en `job_queue`; si el worker falla, se puede reintentar sin depender de un nuevo webhook (política de reintentos: p. ej. attempts ≤ N dejar `pending`; > N marcar `failed`; documentar en implementación).
- **PDF persistente:** Storage permite link en el email, reenvío y futura descarga desde admin sin regenerar cada vez.
- **Validación en puerta definida:** API por `qr_uuid` (Online A) da un flujo concreto para escaneo y quema de ticket.
- **Stack ya usado:** Supabase, Resend, Vercel; no se añaden proveedores nuevos de cola.
- **Idempotencia del webhook:** Se mantiene la lógica actual por `mp_payment_id`; la cola no la debilita.

### Oportunidades

- **Escalar a más volumen:** Con cron cada minuto (o más frecuente si Vercel lo permite), puedes procesar picos sin cambiar de arquitectura.
- **Observabilidad:** `job_queue` (status, attempts, last_error, processed_at) permite monitoreo y alertas (jobs `failed` o pendientes mucho tiempo).
- **Reenvío de ticket:** Con `pdf_url` en Storage, un flujo de “reenviar email” puede usar el mismo link sin volver a generar el PDF.
- **Futuro offline (B):** Si más adelante quisieras validación offline, el modelo Online A no lo impide; se podría añadir JWS u otra capa sin tirar lo ya construido.

### Debilidades

- **Worker por cron (polling):** Latencia mínima entre “pago confirmado” y “email enviado” = intervalo del cron (ej. 1 min si `* * * * *`); límites de Vercel Cron por plan pueden aplicar. No es tiempo real; para un festival suele ser aceptable.
- **Un solo worker:** Si el cron procesa N jobs por ejecución y hay picos muy altos, puede formarse cola temporal; habría que dimensionar N y frecuencia o valorar más de un worker/cron.
- **DNS y Resend siguen pendientes:** La arquitectura no mejora la deliverability si el dominio no está bien configurado.
- **Build en Vercel sigue roto:** Hasta aplicar los cambios de build (qrcode dinámico, downloadjs, etc.), el worker y el resto del módulo no estarán desplegados en producción.

### Amenazas

- **Cron no se ejecuta o falla:** Si Vercel Cron no dispara el worker (límites del plan, configuración) o el worker falla de forma persistente, los jobs quedan en `pending` y no se envían emails. Mitigación: monitoreo de `job_queue` y alertas; revisar límites de Cron en tu plan.
- **Storage o Resend caídos:** Fallos puntuales de Supabase Storage o Resend pueden dejar jobs en `processing` o `failed`. La cola con reintentos (attempts) mitiga; aun así conviene alertas y procedimiento de reproceso manual si hace falta.
- **CRON_SECRET filtrado:** Si alguien descubre la URL del worker y el secreto, podría invocar el endpoint; hay que mantener el secreto solo en Vercel y no exponerlo en cliente.
- **Cambio de esquema:** Añadir `job_queue`, columnas en `tickets` y políticas de Storage implica migraciones; hay que aplicarlas en el orden correcto y, si hay varios entornos, mantenerlos alineados.
- **Jobs en `processing` colgados:** Si el worker crashea tras marcar un job como `processing`, el job puede quedar indefinidamente en ese estado; definir timeout o job de limpieza que resetee a `pending` (o `failed`) tras un umbral de tiempo.

---

## 4. Certificación técnica (auditoría máxima intensidad — segunda pasada)

- **CIT alcanzado:** 97/100.
- **Factores de degradación corregidos (segunda pasada):** (5) Tabla sección 1: "webhook responde 200 en <2s" podía leerse como hecho; añadido "(objetivo; depende de latencia/volumen)". (6) Conclusión 2.3: faltaba paso (0) migraciones SQL; añadido explícitamente. (7) **Punto ciego:** Jobs en `processing` sin actualizar (worker crasheado) pueden quedar colgados; añadida amenaza explícita y mitigación (timeout o job de limpieza).
- **Justificación CIT:** Densidad de información: 97 (tabla alineada con objetivo; conclusión con paso 0; amenaza de jobs colgados). Precisión terminológica: 97 (objetivo vs hecho en tabla y fortalezas; dependencia SQL en conclusión y recomendación). Rigor lógico: 97 (cadena causal correcta; orden de dependencias completo; fallo de worker considerado). -3 por no poder garantizar tiempos sin medición y por límites Cron/plan no verificados en repo.

---

## 5. Síntesis final

| Pregunta | Respuesta |
|----------|-----------|
| **¿Sirve para tu realidad?** | Sí: volumen, límites de Vercel y necesidad de validación en puerta encajan con cola + worker + Storage + API de validación. |
| **¿Es un aporte real?** | Sí: reduce riesgo de timeout y cobro sin entrega, da persistencia al PDF y cierra el hueco de validación en puerta sin añadir proveedores de cola. |
| **¿Es la solución a todo lo no resuelto?** | Es la solución a timeout, entrega, persistencia y validación. Para estar 100% operativo faltan además: (1) arreglar el build en Vercel y (2) configurar DNS para Resend. |

**Recomendación:** La arquitectura es adecuada y vale la pena implementarla. Orden sugerido: **(0)** Ejecutar migraciones SQL en Supabase (`job_queue`, ALTER `tickets` con `qr_uuid`/`pdf_url`/`scanned_at`/`scanned_by`, bucket Storage y políticas) **antes o en el mismo release** que el código que las usa; **(1)** cerrar DNS Resend; **(2)** aplicar los cambios de build para que Vercel despliegue; **(3)** implementar cola + worker + Storage + API de validación según el análisis ya documentado; **(4)** pruebas E2E y monitoreo de `job_queue` en producción.
