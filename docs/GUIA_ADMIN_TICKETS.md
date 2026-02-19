# Guía rápida — Admin Tickets Festival Pucón

Documento de ayuda para imprimir o guardar. Todas las URLs usan la base: **https://www.festivalpucon.cl**

---

## 1. Cómo imprimir tickets

**Objetivo:** Descargar un PDF con todos los tickets de las compras pagadas en **un día de compra** (no acumulado).

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/tickets-por-dia** |
| 2 | Iniciar sesión con la **clave de administrador** (ADMIN_SECRET). |
| 3 | Elegir la **fecha de compra** (ej. día que quieres imprimir). |
| 4 | Pulsar **«Descargar PDF del día»**. |
| 5 | Se descarga un PDF (máx. 50 tickets por día; si hay más, dividir por fechas). |

- Los compradores imprimen sus propios tickets desde **Mis entradas** (enlace que reciben por correo).

---

## 2. Cómo escanear (validar entradas en puerta)

**Objetivo:** Validar el QR del ticket en la entrada (Control de Acceso o Caja).

| Paso | Acción |
|------|--------|
| 1 | Abrir en el celular **https://www.festivalpucon.cl/admin/scanner-v2** |
| 2 | Iniciar sesión con una clave de **Control de Acceso** (Acceso1 … Acceso10) o de **Caja** (Caja1 … Caja4). |
| 3 | Enfocar el QR del ticket (o pegar el código UUID si es manual). |
| 4 | El sistema indica: **ACCESO PERMITIDO**, **Entrada ya utilizada**, **Válido para otro día**, **QR no válido**, etc. |

- **Control de Acceso:** no puede validar tickets tipo PROMO como entrada.
- **Caja:** puede validar todos los tipos, incluido PROMO.

**Alternativa (sin cámara):** **https://www.festivalpucon.cl/admin/validar-qr** — ingresar el código del QR a mano.

---

## 3. Cómo generar tickets de regalo

**Objetivo:** Crear entradas de regalo para una fecha de evento (sin pago).

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/tickets-regalo** |
| 2 | Iniciar sesión con la **clave de administrador**. |
| 3 | Elegir **Fecha** (debe ser un día con evento en la base: event_days). |
| 4 | Elegir **Tipo:** Entrada, Estacionamiento o PROMO. |
| 5 | Indicar **Cantidad**. |
| 6 | Pulsar **«Generar tickets regalo»**. |
| 7 | Descargar o ver el PDF con los tickets generados. |

- Si aparece «No hay evento para esa fecha», esa fecha no está configurada en el sistema (event_days).

---

## 4. Administrar tickets (stock y precios)

**Objetivo:** Ajustar stock nominal, precios, % FOMO y overbooking por día y tipo de ticket.

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/stock** |
| 2 | Iniciar sesión con la **clave de administrador**. |
| 3 | Ver la tabla por **fecha de evento** y **tipo** (Familiar, Todo el Día, Estac., PROMO, etc.). |
| 4 | En la fila que quieras cambiar, pulsar **Editar** (o el botón de edición). |
| 5 | Ajustar **Stock nominal**, **Precio (CLP)**, **% FOMO**, **Overbook %** según necesites. |
| 6 | Guardar cambios. |

Ahí se controlan las variables de tickets: capacidad, precios y umbrales por día.

---

## 5. Informe de tickets del 20 de febrero (solo visualización)

**Objetivo:** Ver un informe formal con tickets vendidos y regalados para el **20 de febrero de 2026**, por tipo (Entrada, Estacionamiento, PROMO), con fecha y hora del informe.

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/informe-20feb** |
| 2 | Se muestra el informe al instante (consulta en ese momento): título del Festival, fecha del evento, **fecha y hora del informe**, tabla con Vendidos / Regalados / Valorizado (CLP) por tipo y total. |
| 3 | Opcional: recargar la página para refrescar datos; se puede imprimir la pantalla. |

- Acceso por enlace (sin clave). Solo lectura. Una sola pantalla con aspecto de informe formal.

---

## 5.1. Estado de tickets (solo lectura)

**Objetivo:** Ver el estado de cada ticket (sin usar / ya usado) y opcionalmente filtrar por fecha de evento.

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/estado-tickets** |
| 2 | Iniciar sesión con la **clave de administrador**. |
| 3 | Opcional: elegir **Fecha evento** y pulsar **Aplicar** para filtrar. |
| 4 | Revisar la tabla: orden, estado (Usado / Sin usar), evento, tipo, fecha de escaneo. |

- Solo lectura. Máx. 500 tickets en la lista.

---

## 5.2. Ventas / Órdenes (solo lectura)

**Objetivo:** Ver el listado de órdenes (ventas) con referencia, email, estado, monto y fecha.

| Paso | Acción |
|------|--------|
| 1 | Abrir **https://www.festivalpucon.cl/admin/ventas** |
| 2 | Iniciar sesión con la **clave de administrador**. |
| 3 | Opcional: filtrar por **Desde / Hasta** (fecha) y **Estado** (Pagado, Pendiente, etc.) y pulsar **Filtrar**. |
| 4 | Revisar la tabla de órdenes. |

- Solo lectura. Máx. 200 órdenes por consulta.

---

## 6. Resumen de URLs útiles

| Uso | URL completa |
|-----|-----------------------------|
| Imprimir tickets por día de compra | https://www.festivalpucon.cl/admin/tickets-por-dia |
| Escanear QR (celular) | https://www.festivalpucon.cl/admin/scanner-v2 |
| Validar QR (entrada manual) | https://www.festivalpucon.cl/admin/validar-qr |
| Tickets de regalo | https://www.festivalpucon.cl/admin/tickets-regalo |
| Stock y precios (administrar variables) | https://www.festivalpucon.cl/admin/stock |
| Informe 20 Feb (vendidos/regalados, sin clave) | https://www.festivalpucon.cl/admin/informe-20feb |
| Estado de tickets (usado/sin usar) | https://www.festivalpucon.cl/admin/estado-tickets |
| Ventas / Órdenes | https://www.festivalpucon.cl/admin/ventas |

---

## 7. Claves (recordatorio)

- **Administrador (todo):** una sola clave configurada en el servidor (ADMIN_SECRET). Necesaria para: imprimir por día, tickets regalo, stock y precios, estado de tickets, ventas/órdenes. (El informe 20 Feb es público por enlace, no requiere clave.)
- **Control de Acceso (10 usuarios):** Acceso1, Acceso2, … Acceso10. Solo scanner / validar QR; no validan PROMO como entrada.
- **Caja (4 usuarios):** Caja1, Caja2, Caja3, Caja4. Solo scanner / validar QR; pueden validar todos los tipos.

*(Las claves se configuran en Vercel: ACCESS_CONTROL_KEYS, CAJA_KEYS; no están en este documento por seguridad.)*

---

*Documento generado para el sistema de tickets Festival Pucón. Actualizar si cambian URLs o flujos.*
