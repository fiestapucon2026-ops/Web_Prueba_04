import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { signTicket } from '@/lib/security/qr-signer';
import type { OrderWithDetails } from './types';

/** Un ticket físico: orden con detalles + id de fila en tabla tickets (QR identifica esta entrada). */
export interface TicketItemForPDF {
  order: OrderWithDetails;
  ticketId: string;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #1e40af',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  value: {
    fontSize: 11,
    color: '#111827',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1 solid #e5e7eb',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  qrImage: {
    width: 150,
    height: 150,
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'center',
  },
});

interface TicketPageProps {
  order: OrderWithDetails;
  qrDataUrl: string;
}

const TicketPDFPage: React.FC<TicketPageProps> = ({ order, qrDataUrl }) => {
  const eventName = order.inventory.event.name;
  const ticketTypeName = order.inventory.ticket_type.name;
  const eventDate = new Date(order.inventory.event.date).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const venue = order.inventory.event.venue;
  const orderDate = new Date(order.created_at).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Festival Pucón 2026</Text>
        <Text style={styles.subtitle}>Ticket de Entrada</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Evento</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Evento:</Text>
          <Text style={styles.value}>{eventName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tipo de Ticket:</Text>
          <Text style={styles.value}>{ticketTypeName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha y Hora:</Text>
          <Text style={styles.value}>{eventDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lugar:</Text>
          <Text style={styles.value}>{venue}</Text>
        </View>
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
          Este ticket es válido solo para el evento y fecha indicados.{'\n'}
          Presenta este documento (impreso o digital) al ingresar al evento.
        </Text>
      </View>
    </Page>
  );
};

/** Genera imagen QR (data URL) para el token firmado del ticket. Solo servidor. */
async function qrDataUrlForToken(token: string): Promise<string> {
  return QRCode.toDataURL(token, { width: 300, margin: 1 });
}

/**
 * Genera un PDF con una página por ticket; cada página lleva QR real que identifica esa entrada (ticket.id).
 * Se invoca tras respuesta exitosa de MP (webhook approved → tickets creados).
 */
export async function generateTicketsPDF(items: TicketItemForPDF[]): Promise<Buffer> {
  const qrDataUrls: string[] = [];
  for (const { order, ticketId } of items) {
    const token = signTicket(ticketId, order.inventory.ticket_type.name);
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
