# AUDITORÍA 502 — CAUSA RAÍZ Y PROTOCOLO SENIOR_REASONING_ENGINE_V3

## [FASE_0: PENSAMIENTO_LATENTE]

- Estado previo declarado: módulo MP 100% operativo; módulo entradas 100% operativo; solo se realizaban mejoras estéticas.
- El 502 aparece en POST /api/entradas/create-preference.
- Conclusión: la regresión fue introducida por un cambio **dentro** del flujo de entradas/create-preference, no por factores externos (token, etc.) que antes no fallaban.

## [FASE_1: DECONSTRUCCIÓN_ADVERSARIA]

### Cambio que introdujo la regresión

**Antes (flujo operativo):**

- `POST /api/entradas/create-preference` recibía: `date`, `ticket_type_id`, `quantity`, `customer.email`.
- **No llamaba a Mercado Pago directamente.** Hacía `fetch(baseUrl + '/api/tickets/create-preference', { body: { event_id, ticket_type_id, quantity, payer_email } })`.
- El módulo de tickets (100% operativo) creaba la preferencia en MP, manejaba idempotencia y devolvía `init_point`.

**Después (soporte entrada + estacionamiento):**

- Se reemplazó el cuerpo por `items: [{ ticket_type_id, quantity }, ...]`.
- Se **eliminó la delegación** a `/api/tickets/create-preference`.
- Se implementó en entradas: resolución de `event_id`, construcción de `lineItems`, llamada **directa** a `requireMercadoPagoClient()` y `preferenceClient.create()` con varios ítems, y creación de varias órdenes.

### Fallo de arquitectura lógica

- **Punto ciego:** Se asumió que la ruta de tickets y la llamada directa al SDK desde entradas eran equivalentes. No lo son: la ruta de tickets incluye idempotencia, manejo de respuestas y posiblemente un uso del SDK validado en producción; la ruta de entradas introduce un nuevo camino (múltiples ítems, body distinto) no ejercitado antes.
- **Asunción débil:** Que `preferenceClient.create({ body: { items: mpItems, ... } })` con varios ítems se comporta igual que con un ítem y no requiere ajustes (formato, validaciones MP, forma del error).

### Validación cruzada

- El 502 se devuelve únicamente en el `catch (mpError)` del bloque que llama a `preferenceClient.create()` (líneas 171–182). Por tanto, el fallo ocurre **en ese nuevo camino**: llamada directa al SDK desde entradas con body multi-ítem.
- No hay cambios en el módulo de tickets; el flujo que antes funcionaba (entradas → tickets → MP) fue **sustituido** por entradas → MP directo cuando se añadió soporte multi-ítem.

## [FASE_2: CUANTIFICACIÓN_CIT]

- **Causa raíz:** Sustitución del flujo “entradas delega en tickets (1 ítem)” por “entradas llama a MP directamente (N ítems)” sin conservar el camino ya probado para 1 ítem y sin validar el nuevo camino multi-ítem.
- **CIT respuesta anterior (error “fuera del módulo”):** ~60. Degradación: descartar que la regresión estuviera dentro del código modificado (precisión terminológica y rigor lógico).
- **CIT esta auditoría:** 95. Factores restantes: no se dispone del mensaje exacto del SDK/MP en el 502 para cerrar al 100% el diagnóstico (p. ej. validación de `items` o de `id`).

## [FASE_3: RE-INFERENCIA]

### Causa raíz técnica

1. **Regresión de diseño:** El flujo que funcionaba (entradas → `/api/tickets/create-preference` → MP) se reemplazó por un flujo nuevo (entradas → `preferenceClient.create()` en entradas) para soportar varios ítems. El 502 ocurre en este nuevo camino.
2. **Riesgo del nuevo camino:**  
   - Uso directo del SDK en entradas con `items[]` (no validado antes en este contexto).  
   - Posible diferencia de formato o validación de MP para preferencias con más de un ítem.  
   - El error del SDK/MP se traduce en excepción y en 502 sin reutilizar la lógica ya probada del módulo de tickets.

### Corrección de ingeniería

- **Restaurar el camino probado cuando hay un solo ítem:** Si `items.length === 1`, no llamar a MP desde entradas; delegar en `POST /api/tickets/create-preference` con `event_id`, `ticket_type_id`, `quantity`, `payer_email` (y opcionalmente Idempotency-Key) y devolver su respuesta. Así el flujo “solo entrada” vuelve a ser el que ya estaba 100% operativo.
- **Multi-ítem:** Mantener la llamada directa a `preferenceClient.create()` solo cuando `items.length > 1`. Mejorar el manejo de errores: capturar y loguear (y en dev devolver) el cuerpo completo del error del SDK/MP para identificar validaciones o formato incorrecto y aplicar la corrección específica.

## [FASE_4: CERTIFICACIÓN_FINAL]

- **Resultado técnico refinado:** La causa del 502 es la **sustitución** del flujo delegado a `/api/tickets/create-preference` por una llamada directa a Mercado Pago en `/api/entradas/create-preference`. El fallo ocurre en ese nuevo camino (llamada directa al SDK con body multi-ítem), no en el módulo de tickets ni en factores que antes funcionaban.
- **CIT alcanzado:** 95.
- **Justificación:** La cadena de inferencia (diff de flujo, único punto de retorno 502, ausencia de cambios en tickets) identifica la causa raíz dentro del módulo modificado; el 5% restante corresponde a no disponer del payload de error exacto de MP/SDK en el 502 para citar la validación o campo concreto que falla.
