import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { signTicket } from '@/lib/security/qr-signer';
import type { OrderWithDetails } from './types';

/** Un ticket físico: orden con detalles + id de fila en tabla tickets (QR identifica esta entrada). qr_uuid opcional para validación Online A. */
export interface TicketItemForPDF {
  order: OrderWithDetails;
  ticketId: string;
  /** Si existe, se usa como contenido del QR (validación en puerta por qr_uuid). */
  qr_uuid?: string | null;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 32,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 16,
    borderBottom: '2 solid #1e40af',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
    backgroundColor: '#f3f4f6',
    padding: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  value: {
    fontSize: 10,
    color: '#111827',
  },
  footer: {
    marginTop: 16,
    paddingTop: 10,
    borderTop: '1 solid #e5e7eb',
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  qrImage: {
    width: 130,
    height: 130,
    marginTop: 12,
    marginBottom: 8,
    alignSelf: 'center',
  },
});

interface TicketPageProps {
  order: OrderWithDetails;
  qrDataUrl: string;
}

const TicketPDFPage: React.FC<TicketPageProps> = ({ order, qrDataUrl }) => {
  const eventName = order.inventory.event.name;
  const isRockLegendsDate = new Date(order.inventory.event.date).toISOString().startsWith('2026-02-20');
  const displayEventName = isRockLegendsDate ? 'PUCÓN ROCK LEGENDS 2026' : eventName;
  const ticketTypeName = order.inventory.ticket_type.name;
  const eventDate = new Date(order.inventory.event.date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const venue =
    order.inventory.event.venue?.replace(/Camping Pucón/g, 'Club de Rodeo Pucón') ??
    order.inventory.event.venue;
  const orderDate = new Date(order.created_at).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Festival Pucón 2026</Text>
        {isRockLegendsDate && <Text style={styles.title}>PUCÓN ROCK LEGENDS 2026</Text>}
        <Text style={styles.subtitle}>QR Ticket de Entrada</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Evento</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Evento:</Text>
          <Text style={styles.value}>{displayEventName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tipo de Ticket:</Text>
          <Text style={styles.value}>{ticketTypeName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text style={styles.value}>{eventDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lugar:</Text>
          <Text style={styles.value}>{venue}</Text>
        </View>
        {(ticketTypeName === 'Familiar' || ticketTypeName === 'Estacionamiento Familiar') && (
          <View style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: '#fef3c7' }}>
            <Text style={{ fontSize: 10, color: '#92400e', fontWeight: 'bold' }}>
              ⚠️ Entrada válida hasta las 17:00 hrs.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de la Compra</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Número de Orden:</Text>
          <Text style={styles.value}>{order.external_reference}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{order.user_email}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha de Compra:</Text>
          <Text style={styles.value}>{orderDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Monto Pagado:</Text>
          <Text style={styles.value}>
            ${order.amount.toLocaleString('es-CL')} CLP
          </Text>
        </View>
      </View>

      <Image style={styles.qrImage} src={qrDataUrl} />

      <View style={styles.footer}>
        <Text>
          Este ticket es válido sólo para el evento y fecha indicados.{'\n'}
          Presenta este documento (impreso o digital) al ingresar al evento.
        </Text>
      </View>
    </Page>
  );
};

/** Genera imagen QR (data URL) para el token del ticket. Solo servidor. Import dinámico evita module-not-found en build Vercel. */
async function qrDataUrlForToken(token: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(token, { width: 300, margin: 1 });
}

/**
 * Genera un PDF con una página por ticket; cada página lleva QR real que identifica esa entrada (ticket.id).
 * Se invoca tras respuesta exitosa de MP (webhook approved → tickets creados).
 */
export async function generateTicketsPDF(items: TicketItemForPDF[]): Promise<Buffer> {
  const qrDataUrls: string[] = [];
  for (const { order, ticketId, qr_uuid } of items) {
    const token =
      qr_uuid != null && qr_uuid !== ''
        ? qr_uuid
        : signTicket(ticketId, order.inventory.ticket_type.name);
    qrDataUrls.push(await qrDataUrlForToken(token));
  }

  const pdfDoc = pdf(
    <Document>
      {items.map((item, i) => (
        <TicketPDFPage
          key={item.ticketId}
          order={item.order}
          qrDataUrl={qrDataUrls[i] ?? ''}
        />
      ))}
    </Document>
  );
  const blob = await pdfDoc.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Un solo ticket (una página). Compatibilidad con flujos que ya llaman por orden.
 * QR identifica la entrada individual (ticketId).
 */
export async function generateTicketPDF(
  order: OrderWithDetails,
  ticketId: string
): Promise<Buffer> {
  return generateTicketsPDF([{ order, ticketId }]);
}
