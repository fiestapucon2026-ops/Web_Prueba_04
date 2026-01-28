// Interfaces TypeScript derivadas del Schema SQL de Supabase
// VERDAD INMUTABLE: Este schema ya está desplegado en Supabase

export interface Event {
  id: string;
  name: string;
  date: Date;
  venue: string;
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
}

export interface Inventory {
  id: string;
  event_id: string;
  ticket_type_id: string;
  total_capacity: number;
}

export interface Order {
  id: string;
  external_reference: string;
  inventory_id: string;
  user_email: string;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  mp_payment_id: string | null;
  created_at: Date;
}

// Tipos para queries con JOINs
export interface OrderWithDetails extends Order {
  inventory: Inventory & {
    event: Event;
    ticket_type: TicketType;
  };
}

// Tipo para creación de preferencia
export interface CreatePreferenceRequest {
  event_id: string;
  ticket_type_id: string;
  quantity: number;
  payer_email: string;
}
