'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const ROCK_DATE = '2026-02-20';
const STORAGE_KEY = 'rock_legends_cart';

type InventoryItem = {
  ticket_type_id: string;
  name: string;
  price: number;
  nominal_stock: number;
  available_stock: number;
  total_capacity: number;
};

function useRockInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/entradas-rock/inventory')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Error al cargar inventario'))))
      .then((data) => {
        setInventory(Array.isArray(data.inventory) ? data.inventory : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return { inventory, loading, error };
}

export default function RockLegendsHome() {
  const { inventory, loading, error } = useRockInventory();

  const ticketsType = inventory.find((i) => i.name === 'Tickets');
  const estacionamientoType = inventory.find((i) => i.name === 'Estacionamiento');
  const promoType = inventory.find((i) => i.name === 'Promo');

  const [ticketsQty, setTicketsQty] = useState(1);
  const [estacionamientoQty, setEstacionamientoQty] = useState(0);
  const [promoQty, setPromoQty] = useState(0);

  const items = useMemo(() => {
    const list: { ticket_type_id: string; quantity: number }[] = [];
    if (ticketsType && ticketsQty > 0) list.push({ ticket_type_id: ticketsType.ticket_type_id, quantity: ticketsQty });
    if (estacionamientoType && estacionamientoQty > 0) list.push({ ticket_type_id: estacionamientoType.ticket_type_id, quantity: estacionamientoQty });
    if (promoType && promoQty > 0) list.push({ ticket_type_id: promoType.ticket_type_id, quantity: promoQty });
    return list;
  }, [ticketsType, estacionamientoType, promoType, ticketsQty, estacionamientoQty, promoQty]);

  const total = useMemo(() => {
    let t = 0;
    if (ticketsType) t += ticketsType.price * ticketsQty;
    if (estacionamientoType) t += estacionamientoType.price * estacionamientoQty;
    if (promoType) t += promoType.price * promoQty;
    return t;
  }, [ticketsType, estacionamientoType, promoType, ticketsQty, estacionamientoQty, promoQty]);

  const handleCompra = () => {
    if (items.length === 0) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ date: ROCK_DATE, items })
      );
    } catch (_) {}
    window.location.href = '/entradas-rock';
  };

  const canBuy = items.length > 0 && total > 0;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header: logo */}
      <header className="pt-8 pb-4 flex justify-center">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-white/20">
          <Image
            src="/images/Logo Negro 3 sin fondo chico.png"
            alt="Logo"
            width={160}
            height={160}
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      {/* Títulos */}
      <div className="text-center px-4 pb-6">
        <p className="text-amber-400/90 text-sm uppercase tracking-widest">Pucón</p>
        <p className="text-white/90 text-lg uppercase tracking-wider">20 de febrero</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-2">PUCÓN ROCK LEGENDS 2026</h1>
        <p className="text-gray-400 mt-1 text-sm">el día donde los himnos cobran vida</p>
        <p className="text-gray-500 mt-2 text-sm">Club de Rodeo de Pucón</p>
      </div>

      {/* 3 bloques: Queen (dorado), Bon Jovi (rojo), Gabriel Marián (blanco/plata, más grande) */}
      <section className="max-w-4xl mx-auto px-4 space-y-4 pb-8">
        <div className="rounded-lg p-5 border border-amber-500/60 bg-amber-950/30 shadow-lg">
          <h2 className="text-amber-400 font-semibold text-lg">Mística Queen</h2>
          <p className="text-amber-200/80 text-sm mt-1">Los himnos que detienen el tiempo y la majestuosidad de Freddie Mercury.</p>
        </div>
        <div className="rounded-lg p-5 border border-red-500/60 bg-red-950/30 shadow-lg">
          <h2 className="text-red-400 font-semibold text-lg">Poder Bon Jovi</h2>
          <p className="text-red-200/80 text-sm mt-1">La dosis exacta de nostalgia para calentar motores.</p>
        </div>
        <div className="rounded-xl p-6 border-2 border-slate-300/70 bg-slate-800/40 shadow-xl scale-[1.02]">
          <h2 className="text-slate-200 font-bold text-xl">Cierre Legendario</h2>
          <p className="text-slate-300 text-sm mt-1">Gabriel Marián detonando la noche con &quot;Ella&quot; y &quot;Mujer Amante&quot;.</p>
        </div>
      </section>

      {/* Selector + total + botón */}
      <section className="max-w-md mx-auto px-4 pb-16">
        {loading && <p className="text-gray-500 text-center py-4">Cargando entradas…</p>}
        {error && <p className="text-red-400 text-center py-4">{error}</p>}
        {!loading && !error && (
          <div className="space-y-4 rounded-lg border border-gray-600 p-5 bg-gray-900/50">
            {ticketsType && (
              <div className="flex justify-between items-center">
                <label className="text-sm">Tickets — ${ticketsType.price.toLocaleString('es-CL')}</label>
                <select
                  value={ticketsQty}
                  onChange={(e) => setTicketsQty(Number(e.target.value))}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
                >
                  {Array.from({ length: Math.min(8, ticketsType.available_stock) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            {estacionamientoType && (
              <div className="flex justify-between items-center">
                <label className="text-sm">Estacionamiento — ${estacionamientoType.price.toLocaleString('es-CL')}</label>
                <select
                  value={estacionamientoQty}
                  onChange={(e) => setEstacionamientoQty(Number(e.target.value))}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
                >
                  <option value={0}>0</option>
                  {estacionamientoType.available_stock > 0 && <option value={1}>1</option>}
                </select>
              </div>
            )}
            {promoType && (
              <div className="flex justify-between items-center">
                <label className="text-sm">Promo — ${promoType.price.toLocaleString('es-CL')}</label>
                <select
                  value={promoQty}
                  onChange={(e) => setPromoQty(Number(e.target.value))}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-2"
                >
                  <option value={0}>0</option>
                  {promoType.available_stock > 0 && <option value={1}>1</option>}
                </select>
              </div>
            )}
            <div className="border-t border-gray-600 pt-4 flex justify-between font-semibold">
              <span>Total</span>
              <span>${total.toLocaleString('es-CL')}</span>
            </div>
            <button
              type="button"
              onClick={handleCompra}
              disabled={!canBuy}
              className="w-full py-3 rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black transition-colors"
            >
              Compra tus tickets
            </button>
          </div>
        )}
      </section>

      <footer className="py-6 text-center text-gray-500 text-xs">
        <Link href="/festival" className="underline hover:text-gray-400">Ver sitio Festival Pucón</Link>
      </footer>
    </main>
  );
}
