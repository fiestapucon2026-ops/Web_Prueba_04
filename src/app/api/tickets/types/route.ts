import { requireSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Endpoint para obtener tipos de tickets disponibles desde BD
// Permite frontend dinámico sin hardcoded data
export async function GET(request: Request) {
  try {
    const supabase = requireSupabaseClient();

    // Obtener todos los tipos de tickets
    const { data: ticketTypes, error: ticketTypesError } = await supabase
      .from('ticket_types')
      .select('id, name, price')
      .order('price', { ascending: true });

    if (ticketTypesError) {
      console.error('Error al obtener tipos de tickets:', ticketTypesError);
      return NextResponse.json(
        { error: 'Error al obtener tipos de tickets' },
        { status: 500 }
      );
    }

    // Obtener eventos activos (futuros)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, date, venue')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true });

    if (eventsError) {
      console.error('Error al obtener eventos:', eventsError);
      return NextResponse.json(
        { error: 'Error al obtener eventos' },
        { status: 500 }
      );
    }

    // Obtener inventario disponible (event_id + ticket_type_id combinaciones)
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('id, event_id, ticket_type_id, total_capacity');

    if (inventoryError) {
      console.error('Error al obtener inventario:', inventoryError);
      return NextResponse.json(
        { error: 'Error al obtener inventario' },
        { status: 500 }
      );
    }

    // Calcular stock disponible para cada combinación
    const inventoryWithStock = await Promise.all(
      (inventory || []).map(async (inv) => {
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('inventory_id', inv.id)
          .in('status', ['pending', 'paid']);

        const soldQuantity = ordersCount || 0;
        const availableStock = inv.total_capacity - soldQuantity;

        return {
          ...inv,
          available_stock: Math.max(0, availableStock),
        };
      })
    );

    // Formatear respuesta
    const response = {
      ticket_types: ticketTypes || [],
      events: events || [],
      inventory: inventoryWithStock,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error en /api/tickets/types:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
