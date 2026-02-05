'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? '';

type PaymentData = {
  external_reference: string;
  transaction_amount: number;
  payer_email: string;
};

function PagoContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!PUBLIC_KEY) {
      setError('Pago on-site no configurado (falta clave pública).');
      setLoading(false);
      return;
    }
    if (!token) {
      setError('Falta token de pago. Vuelve a intentar desde la página de entradas.');
      setLoading(false);
      return;
    }

    let mounted = true;
    fetch(`/api/orders/payment-data?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      })
      .then(({ ok, data }) => {
        if (!mounted) return;
        if (!ok) {
          setError(data?.error ?? 'No se pudo cargar los datos de pago.');
          return;
        }
        if (data.external_reference && Number.isFinite(data.transaction_amount)) {
          setPaymentData({
            external_reference: data.external_reference,
            transaction_amount: data.transaction_amount,
            payer_email: data.payer_email ?? '',
          });
          initMercadoPago(PUBLIC_KEY);
        } else {
          setError(data?.error ?? 'Datos de pago inválidos.');
        }
      })
      .catch(() => {
        if (mounted) setError('Error de conexión.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleSubmit = useCallback(
    async (formData: { token: string; payment_method_id: string; payer?: { email?: string } }) => {
      if (!paymentData) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/orders/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_reference: paymentData.external_reference,
            token: formData.token,
            payment_method_id: formData.payment_method_id,
            payer_email: formData.payer?.email ?? paymentData.payer_email,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
        setError(data?.error ?? 'Error al procesar el pago.');
      } catch {
        setError('Error de conexión.');
      } finally {
        setSubmitting(false);
      }
    },
    [paymentData]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <p>Cargando formulario de pago...</p>
      </main>
    );
  }

  if (error || !paymentData) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 flex items-center justify-center">
        <div className="max-w-md w-full rounded-xl border border-red-700 bg-red-900/20 p-6 text-center">
          <p className="text-red-200">{error ?? 'Datos de pago no disponibles.'}</p>
          <a
            href="/entradas"
            className="mt-4 inline-block rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
          >
            Volver a entradas
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-bold mb-2">Completar pago</h1>
        <p className="text-slate-400 text-sm mb-6">
          Total: ${paymentData.transaction_amount.toLocaleString('es-CL')} CLP
        </p>
        <div className="rounded-xl border border-slate-600 bg-slate-800/50 p-4">
          <CardPayment
            initialization={{
              amount: paymentData.transaction_amount,
              payer: { email: paymentData.payer_email },
            }}
            onSubmit={handleSubmit}
            onError={(e) => setError(e?.message ?? 'Error en el formulario')}
            locale="es-CL"
          />
        </div>
        {submitting && (
          <p className="mt-4 text-center text-slate-400">Procesando pago...</p>
        )}
      </div>
    </main>
  );
}

export default function PagoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <p>Cargando...</p>
        </main>
      }
    >
      <PagoContent />
    </Suspense>
  );
}
