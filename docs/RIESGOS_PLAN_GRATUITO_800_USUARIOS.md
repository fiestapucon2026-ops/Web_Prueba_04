# Riesgos del plan gratuito con ~800 usuarios (1–2 días)

Uso actual: **GitHub**, **Vercel (Hobby)**, **Supabase (Free)** y **Resend (Free)**. En los próximos dos días el sistema será usado por un **máximo de ~800 personas**. Este documento resume qué puede fallar y cómo mitigarlo.

---

## 1. Resumen por servicio

| Servicio   | Plan   | Límite relevante (aprox.)        | Riesgo para 800 usuarios en 2 días   |
|-----------|--------|-----------------------------------|--------------------------------------|
| **Vercel** | Hobby | 1M invocaciones/mes, 100 GB transfer | Bajo si el pico es moderado          |
| **Supabase** | Free | ~5 GB egress, DB limitada, 1 GB Storage | Medio: conexiones y egress en pico   |
| **Resend** | Free | **100 emails/día**, 3.000/mes     | **Alto: solo 100 compradores/día reciben email** |
| **GitHub** | Free | Repo + Actions (si usas)         | Bajo                                 |

---

## 2. Qué puede salir mal (por prioridad)

### 2.1 Crítico: solo 100 emails por día (Resend Free)

- **Límite:** Plan gratuito de Resend = **100 emails/día** (3.000/mes).
- **Efecto:** Si más de 100 personas **compran y confirman pago** en un mismo día, solo las primeras ~100 recibirán el correo con el enlace a “Mis entradas” y el PDF. El resto no recibirá email (el worker seguirá procesando, pero Resend rechazará o limitará los envíos).
- **Mitigación:**
  - Opción A: Pasar a plan de pago de Resend (más envíos/día) para el evento.
  - Opción B: Aceptar que solo 100/día reciben email y que el resto use **“Mis entradas” por otro canal**: por ejemplo, redirigir siempre a una URL con token después del pago (si ya la tenéis) o indicar en la página de éxito que entren por “Mis entradas” con el enlace que se muestra en pantalla (y guardar/descargar PDF ahí). Así no dependéis del email para todos.

### 2.2 Medio: Supabase – conexiones y egress

- **Conexiones:** En Free, Supabase suele limitar conexiones simultáneas a la base (orden de decenas). Cada petición serverless en Vercel que usa Supabase abre una conexión. Con muchos usuarios al mismo tiempo (p. ej. 50–100 concurrentes), podéis acercaros o superar el límite → errores tipo “too many connections” o timeouts.
- **Egress:** Free suele incluir **5 GB de salida** (egress) al mes. Todo lo que sale de Supabase (API REST, Storage, etc.) cuenta. 800 usuarios cargando páginas, PDFs y datos pueden consumir 1–3 GB en 2 días; si hay muchos PDF o consultas pesadas, podéis acercaros a 5 GB.
- **Storage:** Free suele ser 1 GB. Los PDF de tickets en el bucket no suelen ser un problema (cientos de MB como mucho), pero conviene no subir archivos grandes innecesarios.
- **Mitigación:**
  - Evitar picos brutales: si podéis, difundir el link de compra en ventanas distintas.
  - Reducir consultas pesadas o respuestas muy grandes en las APIs que más se usen.
  - Si Supabase os avisa de uso o pausa el proyecto por exceso, tendréis que esperar a que se reanude o subir de plan.

### 2.3 Medio: Vercel Hobby – invocaciones y ancho de banda

- **Invocaciones:** 1 millón de invocaciones/mes. En 2 días, 800 usuarios pueden generar del orden de 20.000–50.000 invocaciones (páginas, APIs, webhooks). Es poco frente a 1M; el riesgo aquí es bajo.
- **Ancho de banda:** 100 GB/mes. Tráfico de HTML, API y algunos PDF en 2 días suele estar muy por debajo; riesgo bajo salvo que hagáis descargas masivas de archivos grandes.
- **Cold start:** La primera petición tras un rato sin tráfico puede tardar 5–15 s. Si el evento arranca a una hora fija, los primeros usuarios pueden notar lentitud.
- **Mitigación:** Mantener el sitio “caliente” haciendo una petición ligera cada pocos minutos (p. ej. a `/api/health` o a la home) antes de abrir la venta.

### 2.4 Bajo: builds y despliegues (GitHub + Vercel)

- **Vercel Hobby:** 100 despliegues/día, 1 build concurrente. Si desplegáis durante el evento y el build falla o tarda, no podéis lanzar otro build a la vez.
- **Recomendación:** Hacer el último despliegue **antes** del día del evento y evitar tocar código en producción durante las 48 h de uso intensivo.

### 2.5 Mercado Pago

- No es un “plan gratuito” como tal; el límite lo pone el volumen y la cuenta MP. Para 800 usuarios en 2 días no suele haber problema técnico de cuota por parte de Vercel/Supabase; lo que importa es tener la cuenta MP en condiciones y los webhooks bien configurados (ya revisado en la auditoría).

---

## 3. Estimación rápida de uso (2 días, hasta 800 usuarios)

| Recurso        | Estimación conservadora     | ¿Dentro del free? |
|----------------|-----------------------------|--------------------|
| Vercel invoc.  | 30.000–60.000 en 2 días     | Sí (límite 1M/mes) |
| Vercel bandwidth | 2–5 GB                     | Sí (100 GB/mes)    |
| Supabase egress | 1,5–4 GB                   | Justo (límite ~5 GB) |
| Supabase conexiones | Picos 30–80 simultáneas | Depende del límite del plan (suele ser bajo) |
| Resend envíos  | 150–300 (1 email por compra) | **No**: 100/día en Free |
| Storage PDF    | &lt; 100 MB                 | Sí (1 GB)          |

---

## 4. Checklist antes del evento (1–2 días)

- [ ] **Resend:** Decidir si subís de plan para &gt;100 compras/día o si asumís que solo 100/día reciben email y el resto usa “Mis entradas” por la web (y/o PDF en pantalla).
- [ ] **Cron del worker:** Confirmar que el cron que llama a `GET /api/workers/process-tickets` con `CRON_SECRET` está activo (si no, no se envían emails ni se generan PDF en Storage). Ver `docs/EMAIL_NO_LLEGAN.md`.
- [ ] **Supabase:** Revisar en el dashboard uso actual de egress y conexiones; si está cerca del límite, evitar despliegues o cambios que añadan tráfico pesado.
- [ ] **Último deploy:** Hacerlo 24 h antes; no desplegar durante la venta salvo emergencia.
- [ ] **Mantener sitio “caliente”:** Opcional: llamada periódica a `/api/health` (o similar) antes de abrir la venta para reducir cold starts.
- [ ] **Comunicación a usuarios:** Si seguís en Resend Free, indicar en la página de éxito que guarden el enlace a “Mis entradas” o descarguen el PDF ahí, por si el email tarda o no llega.

---

## 5. Si algo falla durante el evento

- **“Demasiadas solicitudes” (429):** Puede venir de vuestro rate limit (p. ej. by-reference) o de límites del proveedor. Reducir refrescos automáticos en la web y avisar a usuarios de no abrir muchas pestañas.
- **Páginas o APIs lentas/timeout:** Posible saturación de Supabase (conexiones) o cold start en Vercel. Esperar 1–2 minutos y reintentar; mantener el sitio caliente si es posible.
- **Emails que no llegan:** Ver `docs/EMAIL_NO_LLEGAN.md`. Si superáis 100 envíos/día en Resend Free, los adicionales no se enviarán; el usuario debe usar “Mis entradas” con el token/link de la pantalla de éxito.
- **Proyecto Supabase pausado:** En Free, algunos proyectos se pausan por inactividad o por superar cuotas. Reanudar desde el dashboard de Supabase; puede tardar unos minutos.

---

*Documento de referencia para el evento. Los límites exactos pueden variar; comprobad en las páginas de precios de Vercel, Supabase y Resend.*
