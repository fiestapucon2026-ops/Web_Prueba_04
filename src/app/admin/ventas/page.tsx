'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type OrderRow = {
  id: string;
  external_reference: string;
  user_email: string;
  status: string;
  amount: number;
  created_at: string;
};

type OrdersListData = {
  generated_at: string;
  total: number;
  orders: OrderRow[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VentasPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrdersListData | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const url = `/api/admin/orders/list?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.status === 401) {
        setAuthenticated(false);
        return false;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error || 'Error al cargar');
        return false;
      }
      const json = (await res.json()) as OrdersListData;
      setData(json);
      setAuthenticated(true);
      return true;
    } catch {
      setError('Error de conexión');
      setAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    if (authenticated !== false) fetchData();
  }, [authenticated, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!inputKey.trim()) {
      setLoginError('Ingresa la clave de administrador');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: inputKey.trim() }),
      });
      if (res.status === 401) {
        setLoginError('Clave incorrecta');
        return;
      }
      if (!res.ok) {
        setLoginError('Error al iniciar sesión');
        return;
      }
      setInputKey('');
      setAuthenticated(true);
      await fetchData();
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setData(null);
  };

  if (authenticated === null && loading) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-sm">
          <h1 className="text-xl font-bold mb-4">Ventas / Órdenes</h1>
          <p className="text-slate-400 mb-4">Solo administradores. Clave ADMIN_SECRET.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Clave de administrador"
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500"
            />
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#cc0000] px-4 py-2 font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
            >
              Entrar
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/admin/stock" className="underline">Volver al admin</Link>
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Ventas / Órdenes</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
          >
            Reintentar
          </button>
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/admin/stock" className="underline">Volver al admin</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-6">
          <h1 className="text-xl font-bold">Ventas / Órdenes</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white text-sm"
              placeholder="Desde"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white text-sm"
              placeholder="Hasta"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="rejected">Rechazado</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <button
              type="button"
              onClick={() => fetchData()}
              className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white border border-slate-600 px-3 py-1.5 rounded"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Generado: {data ? new Date(data.generated_at).toLocaleString('es-CL') : '—'} · Total: {data?.total ?? 0}
        </p>

        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-800">
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Referencia</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Email</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Estado</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold text-right">Monto</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(data?.orders ?? []).map((o) => (
                <tr key={o.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-mono text-xs">{o.external_reference}</td>
                  <td className="px-4 py-2 truncate max-w-[200px]" title={o.user_email}>{o.user_email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        o.status === 'paid'
                          ? 'text-green-400'
                          : o.status === 'rejected' || o.status === 'cancelled'
                            ? 'text-red-400'
                            : 'text-amber-400'
                      }
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">${(o.amount ?? 0).toLocaleString('es-CL')}</td>
                  <td className="px-4 py-2 text-slate-400">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.orders?.length === 0 && (
          <p className="text-slate-500 text-center py-8">No hay órdenes para los criterios seleccionados.</p>
        )}

        <p className="mt-6 text-sm text-slate-500">
          <Link href="/admin/stock" className="underline">Volver al stock</Link>
        </p>
      </div>
    </main>
  );
}
