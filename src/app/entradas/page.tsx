'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { DateSelector } from '@/components/date-selector/DateSelector';
import { TicketSelector, type EntradasCart } from '@/components/checkout/TicketSelector';
import { CustomerForm, type CustomerFormValues } from '@/components/checkout/CustomerForm';
import type { EntradasInventoryItem } from '@/app/api/entradas/inventory/route';

const CARD_STYLE = {
  backgroundColor: '#737373',
  boxShadow: '0 4px 14px #d9d9d9',
};

function errorToString(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'message' in raw)
    return String((raw as { message?: unknown }).message);
  if (raw && typeof raw === 'object') return JSON.stringify(raw);
  return fallback;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayName = dayNames[d.getUTCDay()] ?? '';
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()] ?? '';
  return `${dayName} ${day} de ${month}`;
}

export default function EntradasPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [cart, setCart] = useState<EntradasCart>({ mainTicket: null, parking: null, promoTicket: null });
  const [inventory, setInventory] = useState<EntradasInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [soldOutDates] = useState<Set<string>>(new Set());

  const fetchInventory = useCallback(async (date: string) => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const res = await fetch(`/api/entradas/inventory?date=${encodeURIComponent(date)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInventoryError(errorToString(data?.error, 'Error al cargar entradas'));
        setInventory([]);
        return;
      }
      setInventory(data.inventory ?? []);
      setInventoryError(null);
    } catch {
      setInventoryError('Error de conexión');
      setInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setInventory([]);
      setCart({ mainTicket: null, parking: null, promoTicket: null });
      setInventoryError(null);
      return;
    }
    setCart({ mainTicket: null, parking: null, promoTicket: null });
    fetchInventory(selectedDate);
  }, [selectedDate, fetchInventory]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setStep(2);
  }, []);

  const handleVolverToDate = useCallback(() => {
    setStep(1);
    setSelectedDate(null);
  }, []);

  const handleVolverToTickets = useCallback(() => {
    setStep(2);
  }, []);

  const handleCompraTickets = useCallback(() => {
    if (cart.mainTicket) setStep(3);
  }, [cart.mainTicket]);

  const handleCustomerSubmit = useCallback(
    async (values: CustomerFormValues) => {
      if (!selectedDate || !cart.mainTicket) {
        setPurchaseError('Elige una fecha y al menos una entrada antes de continuar.');
        return;
      }
      setPurchaseLoading(true);
      setPurchaseError(null);
      try {
        const items: Array<{ ticket_type_id: string; quantity: number }> = [
          { ticket_type_id: cart.mainTicket.ticket_type_id, quantity: cart.mainTicket.quantity },
        ];
        if (cart.parking) {
          items.push({ ticket_type_id: cart.parking.ticket_type_id, quantity: 1 });
        }
        if (cart.promoTicket && cart.promoTicket.quantity > 0) {
          items.push({ ticket_type_id: cart.promoTicket.ticket_type_id, quantity: cart.promoTicket.quantity });
        }

        const useOnSite = typeof process.env.NEXT_PUBLIC_MP_PUBLIC_KEY === 'string' && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY.length > 0;

        if (useOnSite) {
          const res = await fetch('/api/entradas/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: selectedDate,
              items,
              customer: { email: values.email },
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.payment_data_token) {
            window.location.href = `/pago?token=${encodeURIComponent(data.payment_data_token)}`;
            return;
          }
          setPurchaseError(errorToString(data?.error, 'Error al reservar'));
          setPurchaseLoading(false);
          return;
        }

        const res = await fetch('/api/entradas/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate,
            items,
            customer: { email: values.email },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPurchaseError(errorToString(data?.error, 'Error al iniciar el pago'));
          return;
        }
        const initPoint = data?.init_point;
        if (typeof initPoint === 'string' && initPoint) {
          window.location.href = initPoint;
          return;
        }
        setPurchaseError('No se recibió enlace de pago');
      } catch {
        setPurchaseError('Error de conexión');
      } finally {
        setPurchaseLoading(false);
      }
    },
    [selectedDate, cart]
  );

  const canProceedToForm = Boolean(cart.mainTicket);

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      {/* Fondo: misma imagen y degradado que página de inicio */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/fondo1.png"
          alt="Fondo Festival"
          fill
          className="object-cover object-top"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)',
          }}
        />
      </div>

      {/* Logo: misma posición y proporción que página de inicio */}
      <div className="absolute top-0 right-0 p-6 lg:p-8 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <Image
            src="/images/Logo Negro 3 sin fondo chico.png"
            alt="Logo Festival"
            width={200}
            height={200}
            className="w-auto h-auto max-w-[250px] lg:max-w-[300px]"
            priority
          />
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-2xl px-4 pt-[28vh] pb-12 md:px-6 md:pt-[32vh]">
        {/* Paso 1: Elige la fecha (solo cuando step === 1) */}
        {step === 1 && (
          <div
            className="rounded-xl p-4 md:p-6 text-white"
            style={CARD_STYLE}
          >
            <DateSelector
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              soldOutDates={soldOutDates}
              insideCard
            />
          </div>
        )}

        {/* Paso 2: Elige tu entrada (solo cuando step === 2) */}
        {step === 2 && (
          <div
            className="rounded-xl p-4 md:p-6 text-white"
            style={CARD_STYLE}
          >
            <button
              type="button"
              onClick={handleVolverToDate}
              className="mb-4 rounded-lg bg-[#39ff14] px-4 py-2 font-semibold text-black hover:opacity-90 transition-opacity"
            >
              ← Volver
            </button>
            {inventoryLoading && (
              <p className="text-center text-white/70">Cargando entradas...</p>
            )}
            {inventoryError && !inventoryLoading && (
              <p className="text-center text-red-400">{inventoryError}</p>
            )}
            {!inventoryLoading && inventory.length > 0 && selectedDate && (
              <>
                <TicketSelector
                  inventoryData={inventory}
                  selectedDateLabel={formatDateLabel(selectedDate)}
                  cart={cart}
                  onCartChange={setCart}
                  disabled={purchaseLoading}
                />
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={!canProceedToForm}
                    onClick={handleCompraTickets}
                    className="w-full rounded-lg bg-[#39ff14] px-4 py-3 font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Compra tus entradas
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Paso 3: Datos para tu entrada (solo cuando step === 3) */}
        {step === 3 && (
          <div
            className="rounded-xl p-4 md:p-6 text-white"
            style={CARD_STYLE}
          >
            <button
              type="button"
              className="mb-4 w-full text-center text-lg font-semibold cursor-default"
              style={{ color: '#ffbd59' }}
            >
              Último paso !! … para llegar al Festival Pucón 2026
            </button>
            <button
              type="button"
              onClick={handleVolverToTickets}
              className="mb-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              ← Volver
            </button>
            <h3 className="mb-4 text-lg font-semibold">Datos para tu entrada</h3>
            {purchaseError && (
              <p className="mb-4 text-sm text-red-400">{purchaseError}</p>
            )}
            <CustomerForm
              onSubmit={handleCustomerSubmit}
              disabled={purchaseLoading}
            />
          </div>
        )}
      </main>
    </div>
  );
}
