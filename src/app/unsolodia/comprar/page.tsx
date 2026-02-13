'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TicketSelector_2, type UnSoloDiaInventoryItem } from '@/components/checkout/TicketSelector_2';
import { CustomerForm, type CustomerFormValues } from '@/components/checkout/CustomerForm';
import type { EntradasCart } from '@/components/checkout/TicketSelector';

const ROCK_DATE = '2026-02-20';
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

export default function UnSoloDiaComprarPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [cart, setCart] = useState<EntradasCart>({ mainTicket: null, parking: null, promoTicket: null });
  const [inventory, setInventory] = useState<UnSoloDiaInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/entradas-rock/inventory')
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (data?.inventory && Array.isArray(data.inventory)) {
          setInventory(data.inventory);
          setInventoryError(null);
        } else {
          setInventoryError(errorToString(data?.error, 'Error al cargar entradas'));
          setInventory([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInventoryError('Error de conexión');
          setInventory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCompraTickets = useCallback(() => {
    if (cart.mainTicket) setStep(2);
  }, [cart.mainTicket]);

  const handleVolverToTickets = useCallback(() => {
    setStep(1);
  }, []);

  const handleCustomerSubmit = useCallback(
    async (values: CustomerFormValues) => {
      if (!cart.mainTicket) {
        setPurchaseError('Elige al menos una entrada antes de continuar.');
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

        const useOnSite =
          typeof process.env.NEXT_PUBLIC_MP_PUBLIC_KEY === 'string' &&
          process.env.NEXT_PUBLIC_MP_PUBLIC_KEY.length > 0;

        if (useOnSite) {
          const res = await fetch('/api/entradas/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: ROCK_DATE,
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
            date: ROCK_DATE,
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
    [cart]
  );

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
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

      <main className="relative z-10 mx-auto max-w-2xl px-4 pt-24 pb-12 md:px-6 md:pt-28">
        <Link
          href="/unsolodia"
          className="inline-block mb-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          ← Volver
        </Link>

        {step === 1 && (
          <div className="rounded-xl p-4 md:p-6 text-white" style={CARD_STYLE}>
            {inventoryLoading && (
              <p className="text-center text-white/70">Cargando entradas...</p>
            )}
            {inventoryError && !inventoryLoading && (
              <p className="text-center text-red-400">{inventoryError}</p>
            )}
            {!inventoryLoading && inventory.length > 0 && (
              <>
                <TicketSelector_2
                  inventoryData={inventory}
                  cart={cart}
                  onCartChange={setCart}
                  disabled={purchaseLoading}
                />
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={!cart.mainTicket}
                    onClick={handleCompraTickets}
                    className="w-full rounded-lg bg-[#39ff14] px-4 py-3 font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Compra tu tickets
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl p-4 md:p-6 text-white" style={CARD_STYLE}>
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
            <p className="mb-3 text-base font-medium text-amber-200" aria-live="polite">
              Viernes 20 de febrero 2026 — Club de Rodeo de Pucón
            </p>
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
