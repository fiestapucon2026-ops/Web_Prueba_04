'use client';

import { useState, useEffect } from 'react';
import { EmailSchema } from '@/lib/schemas';

// Interfaces para datos dinámicos desde API
interface TicketType {
  id: string;
  name: string;
  price: number;
}

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
}

interface InventoryItem {
  id: string;
  event_id: string;
  ticket_type_id: string;
  total_capacity: number;
  available_stock: number;
}

interface TypesResponse {
  ticket_types: TicketType[];
  events: Event[];
  inventory: InventoryItem[];
}

export default function TicketPage() {
  const [data, setData] = useState<TypesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado del formulario
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [purchaseLoading, setPurchaseLoading] = useState<boolean>(false);

  // Cargar datos dinámicos al montar
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/tickets/types');
        if (!response.ok) {
          throw new Error('Error al cargar tipos de tickets');
        }
        const result: TypesResponse = await response.json();
        setData(result);
        
        // Auto-seleccionar primer evento y tipo si existen
        if (result.events.length > 0 && result.ticket_types.length > 0) {
          setSelectedEventId(result.events[0].id);
          setSelectedTicketTypeId(result.ticket_types[0].id);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError('Error al cargar la información de tickets. Por favor, recarga la página.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Obtener tipos de tickets disponibles para el evento seleccionado
  const getAvailableTicketTypes = (): TicketType[] => {
    if (!data || !selectedEventId) return [];
    
    const availableInventory = data.inventory.filter(
      inv => inv.event_id === selectedEventId && inv.available_stock > 0
    );
    
    const availableTypeIds = new Set(availableInventory.map(inv => inv.ticket_type_id));
    
    return data.ticket_types.filter(tt => availableTypeIds.has(tt.id));
  };

  // Obtener stock disponible para la combinación seleccionada
  const getAvailableStock = (): number => {
    if (!data || !selectedEventId || !selectedTicketTypeId) return 0;
    
    const inventory = data.inventory.find(
      inv => inv.event_id === selectedEventId && inv.ticket_type_id === selectedTicketTypeId
    );
    
    return inventory?.available_stock || 0;
  };

  // Obtener precio del ticket seleccionado
  const getSelectedTicketPrice = (): number => {
    if (!data || !selectedTicketTypeId) return 0;
    const ticketType = data.ticket_types.find(tt => tt.id === selectedTicketTypeId);
    return ticketType?.price || 0;
  };

  const handlePurchase = async () => {
    // Validación con schemas compartidos (validación manual pero consistente)
    const emailValidation = EmailSchema.safeParse(email);
    if (!emailValidation.success) {
      alert('Por favor, ingresa un email válido');
      return;
    }

    if (!selectedEventId || !selectedTicketTypeId) {
      alert('Por favor, selecciona un evento y tipo de ticket');
      return;
    }

    const availableStock = getAvailableStock();
    // IMPORTANTE: por ahora 1 ticket por orden (schema actual no tiene quantity en orders)
    const quantity = 1;
    if (availableStock < 1) {
      alert('Stock insuficiente. No hay tickets disponibles para esta selección.');
      return;
    }

    setPurchaseLoading(true);

    try {
      // Clave estable por formulario + ventana 5s: doble clic devuelve la misma preferencia (base64url seguro para headers)
      const windowSec = Math.floor(Date.now() / 5000);
      const raw = `${email}|${selectedEventId}|${selectedTicketTypeId}|${windowSec}`;
      const idempotencyKey = typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_')
        : raw;
      const response = await fetch('/api/tickets/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          event_id: selectedEventId,
          ticket_type_id: selectedTicketTypeId,
          quantity: 1,
          payer_email: email,
        }),
      });

      const result = await response.json();

      if (response.ok && result.init_point) {
        // Redirección a Mercado Pago
        window.location.href = result.init_point;
      } else {
        // Error en la respuesta
        alert(result.error || 'Error al procesar el pago. Por favor, intenta nuevamente.');
        setPurchaseLoading(false);
      }
    } catch (err) {
      console.error('Error al crear preferencia:', err);
      alert('Error de conexión. Por favor, verifica tu internet e intenta nuevamente.');
      setPurchaseLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl">Cargando información de tickets...</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl text-red-400">{error || 'Error al cargar datos'}</p>
        </div>
      </main>
    );
  }

  const availableTicketTypes = getAvailableTicketTypes();
  const availableStock = getAvailableStock();
  const selectedTicketPrice = getSelectedTicketPrice();
  const totalAmount = selectedTicketPrice * 1;

  return (
    <main className="min-h-screen bg-slate-900 text-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Compra de Tickets</h1>
          <p className="text-slate-400">Festival Pucón 2026</p>
        </div>

        {/* Contenedor Principal */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 md:p-8">
          {/* Selección de Evento */}
          <div className="mb-8">
            <label htmlFor="event" className="block text-lg font-semibold mb-2">
              Selecciona el Evento
            </label>
            <select
              id="event"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setSelectedTicketTypeId(''); // Reset ticket type al cambiar evento
              }}
              disabled={purchaseLoading}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">-- Selecciona un evento --</option>
              {data.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.date).toLocaleDateString('es-CL')} - {event.venue}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Tipo de Ticket */}
          {selectedEventId && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Selecciona tu ticket</h2>
              {availableTicketTypes.length === 0 ? (
                <p className="text-slate-400">No hay tickets disponibles para este evento</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableTicketTypes.map((ticketType) => {
                    const inventory = data.inventory.find(
                      inv => inv.event_id === selectedEventId && inv.ticket_type_id === ticketType.id
                    );
                    const stock = inventory?.available_stock || 0;
                    const isSelected = selectedTicketTypeId === ticketType.id;

                    return (
                      <button
                        key={ticketType.id}
                        type="button"
                        onClick={() => setSelectedTicketTypeId(ticketType.id)}
                        disabled={purchaseLoading || stock === 0}
                        className={`p-6 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
                        } ${purchaseLoading || stock === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-semibold">{ticketType.name}</h3>
                          <span className="text-2xl font-bold text-blue-400">
                            ${ticketType.price.toLocaleString('es-CL')}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm">
                          Stock disponible: {stock}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Cantidad (por ahora 1 ticket por orden) */}
          {selectedTicketTypeId && (
            <>
              <div className="mb-6 p-4 bg-slate-700/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Cantidad:</span>
                  <span className="text-lg font-semibold">1</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Por ahora, el sistema permite 1 ticket por compra (schema actual).
                </p>
              </div>

              {/* Total */}
              <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg">Total:</span>
                  <span className="text-2xl font-bold text-blue-400">
                    ${totalAmount.toLocaleString('es-CL')} CLP
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Input Email */}
          <div className="mb-6">
            <label htmlFor="email" className="block text-lg font-semibold mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={purchaseLoading}
              placeholder="tu@email.com"
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="mt-1 text-sm text-slate-400">
              Para pruebas con MP (modo prueba):{' '}
              <button
                type="button"
                onClick={() => setEmail('TESTUSER5544200525823207849@testuser.com')}
                className="text-amber-400 hover:underline"
              >
                Usar email de prueba MP
              </button>
            </p>
          </div>

          {/* Botón de Compra */}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={purchaseLoading || !email || !selectedEventId || !selectedTicketTypeId}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all text-lg"
          >
            {purchaseLoading ? 'Redirigiendo a Mercado Pago...' : 'Comprar con Mercado Pago'}
          </button>
        </div>
      </div>
    </main>
  );
}
