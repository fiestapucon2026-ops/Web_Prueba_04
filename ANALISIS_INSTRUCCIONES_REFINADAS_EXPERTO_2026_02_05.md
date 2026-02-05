# Análisis de las instrucciones refinadas del experto (2026-02-05)

**Contexto:** El experto acepta los riesgos adicionales (ciclo de vida, Worker, overlay) y pide implementación para CIT 100% y operatividad total.  
**Estado:** No se ha ejecutado ningún cambio. Solo análisis y conclusiones.

---

## 1. Gestión del worker (punto 1 del experto)

**Instrucción del experto:** Copiar `qr-scanner-worker.min.js` a `/public` y configurar:

```ts
if (typeof window !== 'undefined') {
  QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js';
}
```

**Hallazgo crítico (código real de qr-scanner 1.4.2):**

En `node_modules/qr-scanner/qr-scanner.min.js` (y .umd.min.js), el setter `WORKER_PATH` está implementado así:

```js
static set WORKER_PATH(a){
  console.warn("Setting QrScanner.WORKER_PATH is not required and not supported anymore. Have a look at the README for new setup instructions.")
}
```

- **Conclusión:** En la versión **1.4.2** el setter está **deprecado y no hace nada**: solo muestra un warning. Asignar `QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js'` **no** cambiará la ruta desde la que se carga el worker; la librería sigue usando su lógica interna (dynamic import del worker como módulo).

**Implicaciones:**

1. **No** implementar la “configuración global” del experto tal cual: no tiene efecto y añade un warning en consola.
2. La carga del worker en Next.js depende de cómo el bundler resuelva el **dynamic import** interno de qr-scanner. Si el build incluye o sirve el worker correctamente, no hace falta configurar nada. Si en producción aparece 404 del worker, habrá que aplicar un workaround específico (p. ej. copiar el worker a `public/` y que la app lo cargue por URL solo si la documentación o el código de qr-scanner ofrecen otra API; o revisar configuración de Next para assets/workers).
3. **Recomendación:** Implementar **sin** asignar `WORKER_PATH`. Hacer build de producción y probar en dispositivo real. Si hay 404 del worker, documentar el error y abordar entonces (copiar a public + investigar si la librería permite inyectar URL de worker por otro medio en 1.4.2).

---

## 2. Componente Scanner.tsx (punto 2 del experto)

**Aspectos correctos:**

- Uso de `QrScanner` con opciones (`preferredCamera`, `highlightScanRegion`, `highlightCodeOutline`, `maxScansPerSecond`).
- Callback con `result.data` (con opciones, el resultado es `ScanResult` con `.data`).
- `scanner.stop()` dentro del callback para evitar múltiples disparos.
- Cleanup con `scanner.stop()` y `scanner.destroy()` en el return del `useEffect`.
- Contenedor con `relative`, `aspect-square`, `overflow-hidden`; `<video>` con `object-cover`.

**Ajustes recomendados:**

| Punto | Detalle |
|-------|--------|
| **Dependencia del efecto** | El efecto tiene `[onScanSuccess]`. Si el padre no memoriza el callback (`useCallback`), cada render crea una nueva referencia, se re-ejecuta el efecto, se destruye el scanner y se crea otro → parpadeos y posible bloqueo de cámara. **Recomendación:** En la página, pasar un callback estable con `useCallback`. En Scanner, documentar que `onScanSuccess` debe ser estable o usar un ref para el callback y no ponerlo en deps (patrón ref para evitar recrear scanner). |
| **Error de cámara** | `scanner.start().catch(err => console.error(...))` no comunica el fallo al usuario. La página actual usa `setCameraError` y muestra mensaje + bloque manual. **Recomendación:** Añadir prop opcional `onCameraError?: (err: unknown) => void` y llamarla en el catch; en la página, setear `cameraError` y mostrar el mismo bloque de “fallback manual + imagen”. |
| **Linterna** | Las instrucciones refinadas no incluyen el botón de linterna (el primer informe del experto lo daba como “CRÍTICO para eventos nocturnos”). Se puede dejar para una fase siguiente o añadir: tras `start()` resuelto, `await scanner.hasFlash()` y pasar `hasFlash` al padre para mostrar botón que llame a `scanner.toggleFlash()`. Opcional para “operatividad total” del 2026-02-05. |

---

## 3. Fallback por imagen (punto 3 del experto)

**API de scanImage:**

- `QrScanner.scanImage(file)` (sin opciones): API antigua, devuelve `Promise<string>` (deprecada).
- `QrScanner.scanImage(file, { returnDetailedScanResult: true })`: devuelve `Promise<ScanResult>` con `.data`.

El experto escribe `handleScan(result.data.trim())`, por tanto asume resultado con `.data`. **Recomendación:** Usar explícitamente `QrScanner.scanImage(file, { returnDetailedScanResult: true })` y luego `result.data.trim()` para alinearse con la API actual y evitar deprecación.

**Manejo de error:**

- Si no hay QR, `scanImage` **lanza**. El experto solo hace `console.error("No se detectó QR en la imagen")`. **Recomendación:** Además, mostrar feedback al usuario (ej. `setResult({ valid: false, message: 'No se detectó ningún QR en la imagen.' })` o estado `imageError`) para que el operador sepa que debe repetir la foto.

**Reutilización de lógica:**

- “Reutiliza la lógica de validación UUID”: correcto. El mismo flujo que para el decode por cámara: trim → validar UUID con regex → si no cumple, mensaje local; si cumple, `setValidating(true)`, `validateQrUuid(trimmed)`, `setResult`, `setValidating(false)`. Tanto `onScanSuccess` del Scanner como `handleImageUpload` deben terminar en ese mismo handler (p. ej. un `handleScan(data: string)` que haga validación UUID + POST).

---

## 4. Validación previa y soporte HID (punto 4 del experto)

- **Validación previa UUID:** Ya existe en `handleValidarManual` (UUID_REGEX). Hay que aplicar la **misma** validación en el handler único usado por cámara e imagen: si `!UUID_REGEX.test(trimmed)` → `setResult({ valid: false, message: 'El código no tiene formato de entrada válido (UUID).' })` y no llamar a la API.
- **autoFocus en el input manual:** Tiene sentido para lectores USB/Bluetooth en modo teclado. **Recomendación:** Añadir `autoFocus` al `<input>` del código manual cuando ese bloque esté visible. Tener en cuenta que en React `autoFocus` solo se aplica en el montaje; si el input se oculta y se vuelve a mostrar (“Escanear otra entrada”), puede ser necesario un `ref` y `.focus()` al mostrar de nuevo el bloque o al hacer click en “Escanear otra entrada”.

---

## 5. Integración con la página actual

- La página hoy: login → (authenticated) → div con id `QR_READER_ID` donde se monta html5-qrcode, o bloque manual. Un `useEffect` con deps `[authenticated, handleDecoded, result]` inicia el escáner cuando `authenticated === true` y `result === null`; si hay `result`, no inicia.
- Con el nuevo diseño: en lugar del div por id y la init de html5-qrcode, se renderiza `<Scanner onScanSuccess={handleScan} />` cuando `authenticated && result === null && !cameraError` (o equivalente). El `handleScan` será el mismo que hoy hace `handleDecoded`: validar UUID, llamar `validateQrUuid`, setear `result` y `validating`. Tras éxito, se deja de montar el Scanner (porque `result !== null`) y se muestra el resultado; “Escanear otra entrada” hace `setResult(null)` y se vuelve a montar el Scanner.
- **Cámara fallida:** Si el Scanner llama a `onCameraError`, la página debe setear `cameraError` y no montar el Scanner (o montarlo y dejar que notifique), y mostrar el bloque de “¿FALLA LA CÁMARA? TOMA UNA FOTO” + input manual, como hoy cuando falla la cámara.

---

## 6. Resumen de conclusiones

| Tema | Conclusión |
|------|------------|
| **Worker path** | No aplicar la asignación `QrScanner.WORKER_PATH`; en 1.4.2 no tiene efecto. Probar build sin ella; si hay 404 del worker, tratar como incidencia y buscar workaround (public + otra vía si existe). |
| **Scanner.tsx** | Seguir el patrón del experto con los ajustes: callback estable o uso de ref, y opcionalmente `onCameraError` y botón de linterna en fase posterior. |
| **Fallback imagen** | Usar `scanImage(file, { returnDetailedScanResult: true })`, `result.data.trim()`, y mostrar mensaje al usuario cuando no se detecte QR. |
| **Validación y HID** | Un solo handler para cámara e imagen con validación UUID previa al POST; conservar input manual con autoFocus (o focus programático al volver a “Escanear otra entrada”). |
| **Integración página** | Sustituir init de html5-qrcode por `<Scanner onScanSuccess={handleScan} />` y reutilizar la misma lógica de resultado y de fallback (manual + imagen). |

**Valoración global:** Las instrucciones refinadas son implementables y alineadas con el flujo actual. La única corrección obligatoria es **no** usar `WORKER_PATH`; el resto son mejoras de robustez (estabilidad del callback, feedback de error de cámara e imagen, y opcional linterna). Con estos criterios se puede proceder a la implementación cuando el usuario autorice.

---

*Análisis cerrado. Sin ejecución de código.*
