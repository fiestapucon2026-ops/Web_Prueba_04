# Instrucciones para el nuevo chat — Solo mejoras estéticas

**Copia este contenido al inicio del nuevo chat.** El flujo de venta y tickets está 100% operativo. El único trabajo permitido es **estética**: no se puede tocar el flujo ni la lógica.

---

## REGLA DE ORO (OBLIGATORIA — LA MÁS IMPORTANTE)

- **Los cambios deben ser SOLO estéticos.** No modificar código que afecte al sistema.
- **Sistema** = flujo de pago, APIs, webhooks, tokens, seguridad, órdenes, tickets, Supabase, Mercado Pago, validaciones, llamadas a `create-preference`, `by-reference`, `access-token`, etc.
- **Estética** = solo CSS (clases Tailwind, estilos), textos/copy, imágenes, layout visual, espaciado, colores, tipografía. Sin cambiar lógica, rutas API, ni flujos críticos.
- **Respaldar antes de modificar:** Antes de tocar cualquier archivo, copiarlo a `respaldo_pre_estetica_2026-02-03/` con extensión `.bak` (ej.: `cp src/app/entradas/page.tsx respaldo_pre_estetica_2026-02-03/entradas_page_antes_XXXX.bak`).

---

## ESTADO ACTUAL (NO TOCAR FLUJO)

- **Proyecto:** web_oficial_festival — venta de entradas, Next.js 14+, TypeScript, Vercel, Supabase, Mercado Pago.
- **Producción:** www.festivalpucon.cl. Deploy manual: `cd /home/lvc/web_oficial_festival && npx vercel deploy --prod`.
- **Flujo:** 100% operativo. Entradas → create-preference → MP → Success → Mis entradas → tickets con QR. Precio por día (daily_inventory), RPC atómica (create_orders_atomic con `external_reference::UUID`), rate limit Upstash, RLS, auditoría webhook, token 24h.
- **Fase:** Únicamente mejoras **estéticas**. No tocar el flujo.

---

## RESPALDOS REALIZADOS (2026-02-03)

- **`respaldo_pre_estetica_2026-02-03/`** — Copia de páginas y componentes de UI listos para que el nuevo chat haga cambios solo visuales:
  - `entradas_page.tsx.bak`, `success_page.tsx.bak`, `mis_entradas_page.tsx.bak`
  - `CustomerForm.tsx`, `TicketSelector.tsx`, `page.tsx`, `PantallaInicio.tsx`
- **`respaldo_pre_seguridad_owasp/`** — Respaldo de rutas API y libs modificadas en mejoras de seguridad (entradas/tickets create-preference, by-reference, access-token, webhook, process-tickets, access-token.ts, migración RPC).

---

## QUÉ PUEDE HACER EL NUEVO CHAT (SOLO ESTÉTICA)

- Ajustar colores, tipografía, espaciado, bordes, sombras.
- Cambiar textos/copy (títulos, botones, mensajes) sin alterar la lógica (ej. no quitar o cambiar el significado de errores que vienen del backend).
- Sustituir o añadir imágenes (logo, fondos) en rutas ya existentes.
- Reorganizar layout visual (grid, flex) manteniendo los mismos componentes y flujos (mismos botones, mismos formularios, mismas llamadas a APIs).
- Respaldo antes de cada cambio; no tocar `src/app/api/*`, `src/lib/*` salvo que sea solo estilo/CSS en componentes que ya usan esas rutas.

---

## QUÉ NO PUEDE HACER

- Modificar rutas API (`src/app/api/*`).
- Cambiar lógica de negocio (creación de preferencia, validaciones, manejo de tokens, órdenes, webhooks).
- Añadir o quitar pasos del flujo (ej. pantallas, redirecciones, llamadas a fetch).
- Cambiar schemas, tipos o contratos de datos entre front y API.

---

## ARCHIVOS DONDE ES SEGURO TRABAJAR (SOLO ESTILO/TEXTOS)

- `src/app/entradas/page.tsx` — Página entradas (solo CSS/textos/layout).
- `src/app/success/page.tsx` — Página éxito (solo CSS/textos/layout).
- `src/app/mis-entradas/page.tsx` — Mis entradas (solo CSS/textos/layout).
- `src/components/checkout/TicketSelector.tsx` — Selector de tickets (solo CSS/textos/layout).
- `src/components/checkout/CustomerForm.tsx` — Formulario cliente (solo CSS/textos/layout).
- `src/app/page.tsx`, `src/components/pantalla-inicio/PantallaInicio.tsx` — Inicio (solo CSS/textos/layout).
- `src/app/globals.css` — Estilos globales.
- Otras páginas estáticas o componentes de presentación: solo estética.

---

**Resumen para el asistente:** Flujo 100% operativo. Nuevo chat = solo mejoras estéticas. Regla de oro: no tocar el sistema; respaldar antes de modificar. Usar `respaldo_pre_estetica_2026-02-03/` para respaldos en este ciclo.
