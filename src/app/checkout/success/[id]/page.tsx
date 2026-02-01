'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { TicketCard, type TicketCardData } from '@/components/TicketCardDynamic';

/** Matches GET /api/orders/[id] response. */
interface OrderResponse {
  order_id: string;
  status: string;
  tickets: Array<TicketCardData>;
}

async function fetcher(url: string): Promise<OrderResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || 'Failed to fetch');
  }
  return res.json();
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border-2 border-slate-600 bg-slate-800 p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="h-40 w-40 flex-shrink-0 rounded-lg bg-slate-700" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-slate-700" />
          <div className="h-6 w-32 rounded bg-slate-700" />
          <div className="h-4 w-20 rounded bg-slate-700" />
          <div className="h-5 w-48 rounded bg-slate-700" />
        </div>
      </div>
      <div className="mt-4 h-12 w-full rounded-lg bg-slate-700" />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  const params = useParams();
  const orderId = typeof params?.id === 'string' ? params.id : '';
  const { data, error, isLoading } = useSWR<OrderResponse>(
    orderId ? `/api/orders/${orderId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (!orderId) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold">Orden no especificada</h1>
          <p className="mt-2 text-slate-400">Falta el ID de la orden en la URL.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-red-400">Error al cargar la orden</h1>
          <p className="mt-2 text-slate-400">{error.message}</p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">Cargando tu entrada</h1>
            <p className="mt-1 text-slate-400">Un momento...</p>
          </div>
          <SkeletonCard />
        </div>
      </main>
    );
  }

  if (!data || !data.tickets?.length) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-bold">Sin entradas</h1>
          <p className="mt-2 text-slate-400">No se encontraron entradas para esta orden.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Entrada lista</h1>
          <p className="mt-1 text-slate-400">
            Orden {data.order_id.slice(0, 8)}… · {data.status}
          </p>
        </div>
        <div className="flex flex-col gap-8">
          {data.tickets.map((ticket) => (
            <TicketCard key={ticket.uuid} ticket={ticket} />
          ))}
        </div>
      </div>
    </main>
  );
}
