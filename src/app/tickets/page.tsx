'use client';

import { useState } from 'react';

type TicketType = 'general' | 'vip';

interface TicketOption {
  id: TicketType;
  name: string;
  price: number;
  description: string;
}

const TICKET_OPTIONS: TicketOption[] = [
  {
    id: 'general',
    name: 'Ticket General',
    price: 10000,
    description: 'Acceso general al festival',
  },
  {
    id: 'vip',
    name: 'Ticket VIP',
    price: 25000,
    description: 'Acceso VIP con beneficios exclusivos',
  },
];

export default function TicketPage() {
  const [ticketType, setTicketType] = useState<TicketType>('general');
  const [quantity, setQuantity] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handlePurchase = async () => {
    // Validación de email (regex básico)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Por favor, ingresa un email válido');
      return;
    }

    // Validación de quantity
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      alert('La cantidad debe ser un número entre 1 y 5');
      return;
    }

    // Activar loading
    setLoading(true);

    try {
      const response = await fetch('/api/tickets/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketTypeId: ticketType,
          quantity: quantity,
          payerEmail: email,
        }),
      });

      const data = await response.json();

      if (response.ok && data.init_point) {
        // Redirección a Mercado Pago
        window.location.href = data.init_point;
      } else {
        // Error en la respuesta
        alert(data.error || 'Error al procesar el pago. Por favor, intenta nuevamente.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error al crear preferencia:', error);
      alert('Error de conexión. Por favor, verifica tu internet e intenta nuevamente.');
      setLoading(false);
    }
  };

  const handleQuantityChange = (value: number) => {
    if (value >= 1 && value <= 5) {
      setQuantity(value);
    }
  };

  const selectedTicket = TICKET_OPTIONS.find((t) => t.id === ticketType);

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
          {/* Selección de Tipo de Ticket */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Selecciona tu ticket</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TICKET_OPTIONS.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setTicketType(ticket.id)}
                  disabled={loading}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    ticketType === ticket.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold">{ticket.name}</h3>
                    <span className="text-2xl font-bold text-blue-400">
                      ${ticket.price.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{ticket.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div className="mb-6">
            <label htmlFor="quantity" className="block text-lg font-semibold mb-2">
              Cantidad
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={loading || quantity <= 1}
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-xl"
              >
                −
              </button>
              <input
                id="quantity"
                type="number"
                min="1"
                max="5"
                value={quantity}
                onChange={(e) => handleQuantityChange(Number(e.target.value))}
                disabled={loading}
                className="w-20 text-center bg-slate-700 border border-slate-600 rounded-lg py-2 text-lg font-semibold disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={loading || quantity >= 5}
                className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-bold text-xl"
              >
                +
              </button>
              <span className="text-slate-400">(Máximo 5 tickets)</span>
            </div>
          </div>

          {/* Total */}
          {selectedTicket && (
            <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg">Total:</span>
                <span className="text-2xl font-bold text-blue-400">
                  ${(selectedTicket.price * quantity).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
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
              disabled={loading}
              placeholder="tu@email.com"
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          {/* Botón de Compra */}
          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading || !email}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all text-lg"
          >
            {loading ? 'Redirigiendo a Mercado Pago...' : 'Comprar con Mercado Pago'}
          </button>
        </div>
      </div>
    </main>
  );
}
