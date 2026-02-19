'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type TicketRow = {
  id: string;
  order_id: string;
  status: string;
  scanned_at: string | null;
  created_at: string;
  event_date: string;
  event_name: string;
  ticket_type_name: string;
};

type TicketStatusData = {
  generated_at: string;
  total: number;
  tickets: TicketRow[];
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EstadoTicketsPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TicketStatusData | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const url = filterDate
        ? `/api/admin/reports/ticket-status?date=${encodeURIComponent(filterDate)}`
        : '/api/admin/reports/ticket-status';
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
      const json = (await res.json()) as TicketStatusData;
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
  }, [filterDate]);

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
          <h1 className="text-xl font-bold mb-4">Estado de tickets</h1>
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
          <h1 className="text-xl font-bold mb-2">Estado de tickets</h1>
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
          <h1 className="text-xl font-bold">Estado de tickets</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-400">Fecha evento:</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            />
            <button
              type="button"
              onClick={() => fetchData()}
              className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
            >
              Aplicar
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
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Orden</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Estado</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Evento / Fecha</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Tipo</th>
                <th className="border-b border-slate-700 px-4 py-3 font-semibold">Escaneado</th>
              </tr>
            </thead>
            <tbody>
              {(data?.tickets ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-mono text-xs">{t.order_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2">
                    <span className={t.status === 'used' ? 'text-green-400' : 'text-amber-400'}>
                      {t.status === 'used' ? 'Usado' : 'Sin usar'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {t.event_name} · {t.event_date}
                  </td>
                  <td className="px-4 py-2">{t.ticket_type_name}</td>
                  <td className="px-4 py-2 text-slate-400">{formatDateTime(t.scanned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.tickets?.length === 0 && (
          <p className="text-slate-500 text-center py-8">No hay tickets para los criterios seleccionados.</p>
        )}

        <p className="mt-6 text-sm text-slate-500">
          <Link href="/admin/stock" className="underline">Volver al stock</Link>
        </p>
      </div>
    </main>
  );
}
