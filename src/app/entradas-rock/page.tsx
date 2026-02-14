'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CustomerForm, type CustomerFormValues } from '@/components/checkout/CustomerForm';

const STORAGE_KEY = 'rock_legends_cart';

type Cart = { date: string; items: { ticket_type_id: string; quantity: number }[] };

export default function EntradasRockPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setCart(null);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'date' in parsed &&
        'items' in parsed &&
        Array.isArray((parsed as Cart).items) &&
        (parsed as Cart).items.length > 0
      ) {
        setCart(parsed as Cart);
      } else {
        setCart(null);
      }
    } catch {
      setCart(null);
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: CustomerFormValues) => {
      if (!cart?.items?.length) {
        setError('No hay ítems en el carrito. Vuelve a la home.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const body = {
          date: cart.date,
          items: cart.items,
          customer: { email: values.email },
        };
        const reserveRes = await fetch('/api/entradas/reserve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!reserveRes.ok) {
          const data = await reserveRes.json().catch(() => ({}));
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Error al reservar. Reintenta.'
          );
        }
        const prefRes = await fetch('/api/entradas/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!prefRes.ok) {
          const data = await prefRes.json().catch(() => ({}));
          throw new Error(
            typeof data?.error === 'string' ? data.error : 'Error al crear pago. Reintenta.'
          );
        }
        const data = await prefRes.json();
        const initPoint = data?.init_point;
        if (typeof initPoint === 'string' && initPoint) {
          sessionStorage.removeItem(STORAGE_KEY);
          window.location.href = initPoint;
          return;
        }
        throw new Error('No se recibió enlace de pago');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al procesar');
      } finally {
        setSubmitting(false);
      }
    },
    [cart]
  );

  if (cart === null) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-xl font-semibold mb-4">PUCÓN ROCK LEGENDS 2026</h1>
        <p className="text-slate-300 mb-6">Elige tus entradas en la portada y vuelve a comprar.</p>
        <Link href="/" className="text-amber-400 underline hover:text-amber-300">
          Volver a la portada
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-semibold mb-2">Datos para tu compra</h1>
        <p className="text-slate-400 text-sm mb-6">
          Viernes 20 de febrero 2026 — Club de Rodeo de Pucón
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
            {error}
          </div>
        )}
        <CustomerForm onSubmit={handleSubmit} disabled={submitting} />
        <p className="mt-4 text-center">
          <Link href="/" className="text-slate-400 hover:text-white text-sm underline">
            Volver a la portada
          </Link>
        </p>
      </div>
    </main>
  );
}
