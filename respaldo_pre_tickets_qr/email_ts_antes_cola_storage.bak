import { Resend } from 'resend';
import type { OrderWithDetails } from './types';

// Validación de variable de entorno
const resendApiKey = process.env.RESEND_API_KEY;

// Cliente singleton
let resendClient: Resend | null = null;

if (resendApiKey) {
  resendClient = new Resend(resendApiKey);
} else if (typeof window === 'undefined') {
  console.warn(
    '⚠️ ADVERTENCIA: RESEND_API_KEY no configurado. Las funciones de email no estarán disponibles.'
  );
}

// Helper para validar que el cliente esté inicializado
export function requireResendClient(): Resend {
  if (!resendClient || !resendApiKey) {
    throw new Error(
      '🔴 ERROR: RESEND_API_KEY no está configurado. Configure la variable de entorno en Vercel.'
    );
  }
  return resendClient;
}

// Función para enviar email con ticket PDF adjunto
export async function sendTicketEmail(
  order: OrderWithDetails,
  pdfBuffer: Buffer
): Promise<void> {
  const resend = requireResendClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';

  const eventName = order.inventory.event.name;
  const ticketTypeName = order.inventory.ticket_type.name;
  const eventDate = new Date(order.inventory.event.date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const venue = order.inventory.event.venue;

  await resend.emails.send({
    from: 'Festival Pucón <noreply@festivalpucon.cl>', // Ajustar dominio según configuración
    to: order.user_email,
    subject: `🎫 Tu ticket para ${eventName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1e40af;">¡Gracias por tu compra!</h1>
          <p>Hola,</p>
          <p>Tu pago ha sido confirmado. Adjunto encontrarás tu ticket para:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Evento:</strong> ${eventName}</p>
            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${ticketTypeName}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${eventDate}</p>
            <p style="margin: 5px 0;"><strong>Lugar:</strong> ${venue}</p>
            <p style="margin: 5px 0;"><strong>Orden:</strong> ${order.external_reference}</p>
          </div>
          <p>Por favor, presenta este ticket (impreso o en tu dispositivo) al ingresar al evento.</p>
          <p>Si tienes alguna pregunta, contáctanos respondiendo a este email.</p>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            Festival Pucón 2026<br>
            <a href="${baseUrl}" style="color: #1e40af;">${baseUrl}</a>
          </p>
        </body>
      </html>
    `,
    attachments: [
      {
        filename: `ticket-${order.external_reference}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}

/** Resumen de ítem para el email único por compra. */
export interface PurchaseItemSummary {
  eventName: string;
  ticketTypeName: string;
  quantity: number;
}

/**
 * Envía un solo email por compra con enlace a "Mis entradas" y opcionalmente PDF único con todos los tickets.
 * Fuente email: payment.payer.email; fallback: orders[0].user_email.
 */
export async function sendPurchaseEmail(
  to: string,
  accessToken: string,
  itemsSummary: PurchaseItemSummary[],
  pdfBuffer?: Buffer
): Promise<void> {
  const resend = requireResendClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.festivalpucon.cl';
  const misEntradasUrl = `${baseUrl}/mis-entradas?token=${encodeURIComponent(accessToken)}`;

  const itemsHtml = itemsSummary
    .map(
      (i) =>
        `<li style="margin: 4px 0;">${i.quantity}x ${i.ticketTypeName} — ${i.eventName}</li>`
    )
    .join('');

  const attachments = pdfBuffer
    ? [
        {
          filename: 'entradas-festival-pucon.pdf',
          content: pdfBuffer,
        },
      ]
    : [];

  await resend.emails.send({
    from: 'Festival Pucón <noreply@festivalpucon.cl>',
    to,
    subject: 'Tu compra — Festival Pucón 2026',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1e40af;">¡Gracias por tu compra!</h1>
          <p>Tu pago ha sido confirmado. Resumen de tu compra:</p>
          <ul style="list-style: none; padding-left: 0;">
            ${itemsHtml}
          </ul>
          <p style="margin-top: 24px;">
            <a href="${misEntradasUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver y descargar mis entradas</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">El enlace es válido 7 días. Presenta tu entrada (impresa o en tu dispositivo) al ingresar al evento.</p>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            Festival Pucón 2026<br>
            <a href="${baseUrl}" style="color: #1e40af;">${baseUrl}</a>
          </p>
        </body>
      </html>
    `,
    attachments,
  });
}
