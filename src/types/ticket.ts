/** Ticket item from GET /api/orders/[id]. Token is read-only; no signing or modification. */
export interface TicketCardData {
  uuid: string;
  category: string;
  access_window: string;
  qr_token: string;
}
