import { requireSupabaseClient } from '@/lib/supabase';
import { generateTicketPDF } from '@/lib/pdf';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Schema de validación
const GeneratePDFSchema = z.object({
  order_id: z.string().uuid('order_id debe ser un UUID válido'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validación con Zod
    const validationResult = GeneratePDFSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { order_id } = validationResult.data;

    // Conectar a Supabase
    const supabase = requireSupabaseClient();

    // Obtener orden con todos los detalles (JOINs)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        inventory:inventory_id (
          *,
          event:event_id (
            *
          ),
          ticket_type:ticket_type_id (
            *
          )
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Error al obtener orden:', orderError);
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Transformar datos para el tipo OrderWithDetails
    const orderWithDetails = {
      id: order.id,
      external_reference: order.external_reference,
      inventory_id: order.inventory_id,
      user_email: order.user_email,
      amount: Number(order.amount),
      status: order.status as 'pending' | 'paid' | 'rejected',
      mp_payment_id: order.mp_payment_id,
      created_at: new Date(order.created_at),
      inventory: {
        id: order.inventory.id,
        event_id: order.inventory.event_id,
        ticket_type_id: order.inventory.ticket_type_id,
        total_capacity: order.inventory.total_capacity,
        event: {
          id: order.inventory.event.id,
          name: order.inventory.event.name,
          date: new Date(order.inventory.event.date),
          venue: order.inventory.event.venue,
        },
        ticket_type: {
          id: order.inventory.ticket_type.id,
          name: order.inventory.ticket_type.name,
          price: Number(order.inventory.ticket_type.price),
        },
      },
    };

    // Generar PDF
    const pdfBuffer = await generateTicketPDF(orderWithDetails);

    // Retornar PDF como respuesta (convertir Buffer a Uint8Array para compatibilidad)
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${order.external_reference}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error al generar PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar el PDF del ticket' },
      { status: 500 }
    );
  }
}
