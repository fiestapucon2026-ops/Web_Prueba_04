# Análisis crítico del informe del experto — Control de acceso QR

**Objetivo:** Evaluar el informe del experto antes de ejecutar; emitir conclusiones y criterios para seguir.  
**No se ha ejecutado ningún cambio de código.**

---

## 1. Validación de las tesis del experto

### 1.1 Error de selección de dependencia (html5-qrcode vs qr-scanner)

**Conclusión: Sostenible.**

- **qr-scanner (Nimiq):** En `package.json` está como `^1.4.2`. El README y los tipos confirman:
  - WebWorker para no bloquear el main thread.
  - Uso de BarcodeDetector nativo cuando existe (Chrome Android, etc.) y fallback con worker.
  - Benchmarks oficiales: 2–3× (y hasta 8×) mejor detección que LazarSoft/jsqrcode; no se compara directamente con html5-qrcode.
- La afirmación de “1–2 órdenes de magnitud” no está referenciada en la documentación de qr-scanner; la documentación habla de 2–3× y hasta 8× frente a otra librería. La dirección (mejor rendimiento y menor carga en main thread) es correcta.
- **Recomendación:** Aceptar el cambio de librería; el beneficio técnico (worker, BarcodeDetector, menor peso cuando hay soporte nativo) justifica la refactorización.

### 1.2 Error de configuración viewport (qrbox fijo)

**Conclusión: Plausible y coherente con la API.**

- En la implementación actual: `qrbox: { width: 250, height: 250 }` (html5-qrcode). En móviles con DPI alto y aspect ratio alargado, un recorte fijo puede no coincidir con el área útil y degradar el decode.
- **qr-scanner** no usa “qrbox”; usa `calculateScanRegion`. Por defecto (si no se pasa) es: región centrada, dos tercios del menor lado del video, escalada a 400×400. Es decir, región adaptativa.
- El experto indica “no definir qrbox fijo, dejar que la librería calcule el área óptima”. Con qr-scanner eso se cumple no pasando `calculateScanRegion` (o pasando una función que mantenga lógica proporcional). Correcto.

### 1.3 Falta de fallback (solo cámara en vivo)

**Conclusión: Acertada.**

- Depender solo de `getUserMedia` no cubre: permisos denegados, cámaras lentas o mal enfoque, poca luz. Un `input type="file" accept="image/*" capture="environment"` delega captura y enfoque al OS y da una vía alternativa sin cambiar el flujo de validación (mismo `onScan` → mismo POST).
- **Recomendación:** Incluir el fallback por imagen tal como propone el experto.

---

## 2. Contraste instrucciones del experto vs API real (qr-scanner 1.4.2)

Se revisaron `node_modules/qr-scanner/types/qr-scanner.d.ts` y el README del paquete.

| Instrucción del experto | API real | Observación |
|-------------------------|----------|-------------|
| `preferredCamera: 'environment'` | ✅ Opción en el objeto de opciones. | Correcto. |
| `highlightScanRegion: true`, `highlightCodeOutline: true` | ✅ Existen en el constructor. | Correcto. |
| `returnDetailedScanResult: true` | ✅ Opción documentada. Callback recibe `ScanResult` con `data` y `cornerPoints`. | Necesario para usar `result.data` en el callback. |
| `maxScansPerSecond: 10` | ✅ Opción válida (por defecto 25). | Correcto; 10 es razonable para ahorro de batería/CPU. |
| Callback `(result) => onScan(result.data)` | ✅ Con `returnDetailedScanResult: true`, el resultado es `{ data: string, cornerPoints }`. | Correcto. |
| `QrScanner.scanImage(file)` | ✅ Método estático. Con API nueva: `scanImage(file, { returnDetailedScanResult: true })` → `Promise<ScanResult>`; usar `result.data`. | Si no se pasan opciones, la API antigua devuelve `Promise<string>` (deprecada). Preferible usar opciones y `result.data`. |
| `hasFlash()` | ✅ Es método de **instancia** y **async**. Debe invocarse **después** de `start()` (README: “after the scanner was successfully started”). | No se puede llamar antes de tener instancia iniciada. Flujo: `start()` → `await qrScanner.hasFlash()` → guardar en estado y mostrar/ocultar botón de linterna. |

**Ajustes necesarios respecto al informe:**

1. **Linterna:** No se puede “detectar si hasFlash() es true” en el primer render. Hay que: iniciar el scanner, en el `.then()` de `start()` llamar a `await scanner.hasFlash()` y actualizar estado (ej. `setHasFlash(boolean)`) para mostrar el botón.
2. **scanImage (fallback):** Usar `QrScanner.scanImage(file, { returnDetailedScanResult: true }).then(r => onScan(r.data))`. Si no hay QR, `scanImage` **lanza**. Hay que capturar la excepción y mostrar mensaje tipo “No se encontró QR en la imagen”.

---

## 3. Puntos ciegos y riesgos no cubiertos por el experto

### 3.1 Worker en Next.js

- qr-scanner carga `qr-scanner-worker.min.js` por import dinámico. En bundlers que no copian workers automáticamente puede haber 404.
- En Next.js, los workers en `node_modules` pueden resolverse o no según versión y configuración. **Riesgo:** En build o en runtime, fallo al cargar el worker.
- **Recomendación:** Tras implementar, probar en build de producción (y en dispositivo real). Si falla la carga del worker, opciones: copiar `qr-scanner-worker.min.js` a `public/` y configurar `QrScanner.WORKER_PATH` (la API está deprecada pero existe) o revisar documentación de Next para servir workers desde `node_modules`.

### 3.2 Contenedor del video y overlay

- Con `highlightScanRegion` / `highlightCodeOutline`, la librería crea un overlay (accesible por `qrScanner.$overlay`) como hermano del `<video>`.
- El README indica que el overlay es “absolutely positioned”. El contenedor del `<video>` debe tener `position: relative` y espacio suficiente para que video y overlay se superpongan correctamente.
- El experto pide “object-fit: cover” y “100% del contenedor padre”; no menciona el wrapper. **Recomendación:** Usar un wrapper con `position: relative`, `aspect-ratio` (p. ej. 3/4) y sin altura fija en px, y dejar que el overlay se posicione dentro de ese contenedor.

### 3.3 Limpieza y ciclo de vida

- El experto no detalla: parar/destruir el scanner al desmontar el componente, al cambiar a “Escanear otra entrada” o tras un decode exitoso (para no seguir escaneando).
- **Recomendación:** En el componente Scanner: `useEffect` cleanup llamando a `scanner.stop()` y `scanner.destroy()`. En la página: tras validación exitosa, dejar de renderizar el Scanner (o indicar al Scanner que se detenga) y mostrar resultado; en “Escanear otra entrada” resetear estado y volver a montar/iniciar el Scanner.

### 3.4 Manejo de errores de cámara

- Si `start()` falla (permisos, sin cámara), la página debe seguir mostrando el bloque de validación manual y, si se implementa, el fallback por imagen. El experto no especifica el mensaje ni el estado. **Recomendación:** Mantener el patrón actual: mensaje tipo “No se pudo iniciar la cámara…” y mostrar input manual + input file.

### 3.5 Dependencia html5-qrcode

- El experto no dice si eliminar `html5-qrcode` de `package.json`. **Recomendación:** Tras validar en producción que qr-scanner cumple el objetivo, eliminar `html5-qrcode` para evitar confusión y reducir tamaño de bundle.

---

## 4. Coherencia con el flujo actual

- La página actual: login admin → comprobación de sesión → escáner o error de cámara → resultado (válida/rechazada) → “Escanear otra entrada” (reseteo).
- El experto pide: mismo estado de resultado, validación local por regex UUID antes del POST, mismo manejador para decode (cámara) y para imagen (scanImage). Eso es compatible con el flujo actual y con la API `POST /api/admin/tickets/validate`.
- **Conclusión:** La refactorización puede integrarse sin cambiar contrato de la API ni auth; solo se sustituye el motor de lectura y se añade el fallback por imagen.

---

## 5. Conclusiones y criterios para seguir

### 5.1 Valoración global del informe

- **Auditoría (A, B, C):** Técnicamente sólida. La elección de qr-scanner, la crítica al qrbox fijo y la necesidad de fallback por imagen son correctas y aplicables.
- **Instrucciones de ejecución:** En su mayoría correctas; requieren pequeños ajustes (hasFlash tras start, scanImage con opciones y manejo de excepción, ciclo de vida y overlay).

### 5.2 Recomendación

- **Seguir con la refactorización** según el plan del experto, incorporando:
  1. Componente `Scanner` con qr-scanner (opciones validadas contra la API real).
  2. Linterna: consultar `hasFlash()` después de `start()` y bindear botón a `toggleFlash()` (o turnOn/turnOff).
  3. Fallback: `<input type="file" accept="image/*" capture="environment">` + `QrScanner.scanImage(file, { returnDetailedScanResult: true })` y manejo de error “No se encontró QR”.
  4. Contenedor con `position: relative` y `aspect-ratio` (sin altura fija), y limpieza en unmount y al resetear.
  5. Verificación en build de producción y, si hace falta, configuración del worker (path o copia en `public/`).

### 5.3 Orden sugerido de ejecución

1. **Fase 1:** Crear `components/Scanner.tsx` con qr-scanner (sin fallback de imagen), integrar en `/admin/validar-qr`, mantener validación manual por UUID. Probar en dispositivo real y en build de producción (incl. carga del worker).
2. **Fase 2:** Añadir fallback por imagen (input file + scanImage) y botón de linterna condicional.
3. **Fase 3:** Si todo es estable, eliminar dependencia `html5-qrcode`.

### 5.4 Criterio de éxito

- En condiciones representativas (móvil, QR en pantalla o impreso, luz normal y baja si es posible): la cámara en vivo decodifica de forma fiable y, si no, el fallback por imagen permite validar. La validación manual por UUID se mantiene operativa.

---

*Análisis cerrado. No se ha ejecutado código; pendiente de autorización para implementar.*
