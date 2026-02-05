# Informe técnico actualizado para experto: Control de acceso por QR — cambios aplicados y problema persistente

**Destinatario:** Experto en sistemas de validación / lectura QR / control de acceso.  
**Objetivo:** Actualizar el estado tras aplicar las recomendaciones previas; el escáner sigue sin decodificar. Solicitar diagnóstico y alternativas.  
**Proyecto:** web_oficial_festival (Next.js 16, Vercel, Supabase).  
**Fecha:** 2026-02-05 (actualización).

---

## 1. Resumen ejecutivo

- **Recomendaciones del informe anterior aplicadas:** Sustitución de html5-qrcode por **qr-scanner** (Nimiq), sin qrbox fijo, con highlight de región y de código, flujo solo escaneo por cámara (sin validación manual por código, sin subida de imagen, sin linterna).
- **Problema que persiste:** En el celular del control de acceso, la cámara se inicia correctamente, el QR del otro celular se ve en pantalla dentro del recuadro (con los marcadores amarillos visibles), pero **el motor no decodifica**: no se dispara el callback de lectura. El usuario reporta: “no escanea”.
- **Petición:** Diagnóstico de por qué qr-scanner no decodifica a pesar de que el QR es visible en el viewfinder, y recomendación de pasos concretos (código, configuración o alternativa) para lograr lectura fiable en este escenario (QR mostrado en pantalla de otro móvil, escaneado con la cámara del dispositivo del validador).

---

## 2. Cambios implementados desde el informe anterior

### 2.1 Sustitución de librería

- **Antes:** html5-qrcode v2.3.8 (procesamiento en main thread, qrbox fijo 250×250).
- **Ahora:** **qr-scanner** v1.4.2 (Nimiq). Uso de BarcodeDetector nativo cuando está disponible y WebWorker como fallback. Sin qrbox fijo; la librería calcula la región de escaneo.

### 2.2 Nuevo componente `src/components/Scanner.tsx`

- **Motor:** `import QrScanner from 'qr-scanner'`.
- **Configuración del constructor:**
  - `preferredCamera: 'environment'`
  - `highlightScanRegion: true`
  - `highlightCodeOutline: true`
  - `maxScansPerSecond: 10`
  - `returnDetailedScanResult: true`
- **Callback:** Recibe `result.data`; se hace `scanner.stop()` y se llama `onScanSuccess(result.data.trim())`.
- **Ciclo de vida:** En el `useEffect`, `scanner.start().catch(onCameraError)`. En el cleanup: `scanner.stop()` y `scanner.destroy()`.
- **Contenedor:** `<div className="relative w-full aspect-square overflow-hidden ...">` con `<video ref={videoRef} className="w-full h-full object-cover" playsInline muted />`. Sin altura fija en píxeles.
- **Worker:** No se asigna `QrScanner.WORKER_PATH` (en 1.4.2 el setter está deprecado y no tiene efecto). Se confía en la resolución por defecto del bundler (Next.js).

### 2.3 Página `src/app/admin/validar-qr/page.tsx`

- **Integración:** Se renderiza `<Scanner onScanSuccess={handleScan} onCameraError={handleCameraError} />` cuando el usuario está autenticado y no hay resultado previo.
- **handleScan:** Valida el string con regex UUID; si cumple, llama a `POST /api/admin/tickets/validate` con `{ qr_uuid: trimmed }` y muestra el resultado (válida/rechazada).
- **Eliminado a petición del cliente:**
  - Bloque de validación por código manual (input + botón “Validar código”).
  - Cualquier opción de “Subir imagen” o captura de foto para decodificar QR.
  - Botón de linterna (se consideró complejidad innecesaria).
- **Cuando falla la cámara:** Solo se muestra el mensaje “No se pudo iniciar la cámara. Revisa los permisos del navegador.” (sin fallback de entrada manual ni de imagen).
- **Cabeceras de caché:** En `next.config.ts` la ruta `/admin/validar-qr` tiene `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` para evitar que navegador/CDN sirvan una versión antigua.

### 2.4 Dependencias

- **Eliminada:** html5-qrcode.
- **En uso para el escáner:** qr-scanner ^1.4.2.
- **En uso para generación de QR (PDF / Mis entradas):** qrcode ^1.5.4.

### 2.5 URL y entorno

- **Producción:** https://www.festivalpucon.cl/admin/validar-qr
- **Stack:** Next.js 16.1.4 (Turbopack), React 19, despliegue en Vercel. La página es client-side (`'use client'`).

---

## 3. Comportamiento observado (actual)

- **Cámara:** Se inicia correctamente en el dispositivo del validador (celular). El usuario ve el stream de vídeo y el recuadro de escaneo con los marcadores amarillos (highlightScanRegion / highlightCodeOutline).
- **QR en pantalla:** El QR mostrado en el otro celular (entrada en “Mis entradas” o similar) se encuadra dentro del recuadro y es claramente visible en la captura de pantalla proporcionada por el usuario.
- **Decodificación:** No ocurre. El callback de `QrScanner` (onDecode) no se dispara; no se muestra “Validando…” ni resultado. El usuario indica: “no escanea”.
- **Dispositivo/navegador:** Probado en al menos dos navegadores en el mismo celular; el problema se repite. No se ha recopilado marca/modelo de dispositivo, versión de OS ni versión exacta del navegador en el momento del fallo.
- **Backend:** La API `POST /api/admin/tickets/validate` y la lógica en `src/lib/tickets/validate.ts` no han sido modificadas; cuando se envía un UUID válido (p. ej. en pruebas anteriores por código manual), la respuesta y el UPDATE en BD son correctos.

---

## 4. Hipótesis no confirmadas (para el experto)

- **Origen del QR en pantalla:** El QR se muestra en una pantalla de otro móvil (no impreso). Posible efecto de brillo, refresco de pantalla, compresión del navegador o tamaño en píxeles que degrade la señal para el decoder.
- **BarcodeDetector / Worker:** En el dispositivo real, no se sabe si qr-scanner está usando BarcodeDetector nativo o el Worker. Si el Worker no se carga correctamente en el entorno Next/Vercel (p. ej. 404 del script del worker), el fallback podría comportarse distinto o fallar en silencio.
- **Resolución/calidad del stream:** No se ha probado forzar resolución mínima o aspect ratio en `getUserMedia`; la configuración actual solo usa `preferredCamera: 'environment'`.
- **Frecuencia de escaneo:** `maxScansPerSecond: 10`; no se ha probado subir o bajar este valor para ver si afecta a la detección en este escenario.

---

## 5. Solicitud al experto

1. **Diagnóstico:** Indicar las causas más probables por las que qr-scanner no decodifica cuando el QR es visible en el viewfinder (escenario: QR en pantalla de otro móvil, cámara trasera del validador). Incluir, si aplica, comprobaciones en consola o en el código (p. ej. si el Worker se carga, si BarcodeDetector está disponible).
2. **Ajustes recomendados:** Cambios concretos en la configuración de QrScanner o en el flujo (resolución de cámara, región de escaneo, fps, etc.) que puedan mejorar la tasa de lectura en este uso.
3. **Alternativas:** Si se considera que el escenario “QR en pantalla de otro móvil” es inherentemente problemático para esta librería o para Web APIs en móvil, sugerir alternativas (otra librería, otro formato de código, flujo operativo distinto, o hardware externo) sin asumir que el cliente aceptará subida de imágenes o validación por código manual (ya descartados).

---

## 6. Referencias de código actual

| Componente | Ruta |
|------------|------|
| Componente escáner | `src/components/Scanner.tsx` |
| Página validar QR | `src/app/admin/validar-qr/page.tsx` |
| API validación | `src/app/api/admin/tickets/validate/route.ts` |
| Lógica validación | `src/lib/tickets/validate.ts` |
| Cabeceras no-cache | `next.config.ts` (bloque `headers()` para `/admin/validar-qr`) |

---

*Fin del informe actualizado.*
