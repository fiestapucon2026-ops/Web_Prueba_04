'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

function todayChile(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .slice(0, 10);
}

export default function TicketsPorDiaPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(todayChile());
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/check', { credentials: 'include' });
      if (res.status === 401) {
        setAuthenticated(false);
        setIsAdmin(false);
        return;
      }
      if (!res.ok) {
        setAuthenticated(false);
        setIsAdmin(false);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; role?: string };
      setAuthenticated(Boolean(data.ok));
      setIsAdmin(data.role === 'admin');
    } catch {
      setAuthenticated(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      setIsAdmin(true);
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setIsAdmin(false);
  };

  const handleDownload = async () => {
    const d = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setMessage({ type: 'error', text: 'Fecha inválida. Use YYYY-MM-DD.' });
      return;
    }
    setMessage(null);
    setDownloadLoading(true);
    try {
      const res = await fetch(
        `/api/admin/orders/pdf-by-date?date=${encodeURIComponent(d)}`,
        { credentials: 'include' }
      );
      if (res.status === 401) {
        setMessage({ type: 'error', text: 'Sesión expirada. Vuelve a iniciar sesión.' });
        return;
      }
      if (res.status === 400) {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: 'error', text: data.error ?? 'Parámetro inválido.' });
        return;
      }
      if (res.status === 404) {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: 'error', text: data.error ?? 'No hay tickets para esa fecha.' });
        return;
      }
      if (res.status === 413) {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: 'error', text: data.error ?? 'Demasiados tickets para ese día.' });
        return;
      }
      if (!res.ok) {
        setMessage({ type: 'error', text: 'Error al generar el PDF.' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-${d}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Descarga iniciada.' });
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setDownloadLoading(false);
    }
  };

  if (authenticated === null || loading) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Tickets por día</h1>
          <p className="text-slate-400">Cargando...</p>
        </div>
      </main>
    );
  }

  if (!authenticated || !isAdmin) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-md">
          <h1 className="text-xl font-bold mb-4">Tickets por día</h1>
          <p className="text-slate-400 mb-4">
            Solo administradores. Inicia sesión con la clave ADMIN_SECRET.
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Clave de administrador"
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500"
              autoComplete="current-password"
            />
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#cc0000] px-4 py-2 font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
            >
              {loading ? 'Comprobando...' : 'Iniciar sesión'}
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/admin/stock" className="underline">
              Volver al admin
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Imprimir tickets por día de compra</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-400 hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>
        <p className="mb-6 text-slate-400">
          Descarga un PDF con todos los tickets de las compras pagadas en la fecha elegida (día en
          Chile). Máximo 50 tickets por día; si hay más, divide por tramos o contacta soporte.
        </p>
        <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Fecha de compra</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            />
          </label>
          {message && (
            <p
              className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}
            >
              {message.text}
            </p>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadLoading}
            className="w-full rounded bg-[#cc0000] px-4 py-3 font-semibold text-white hover:bg-[#b30000] disabled:opacity-50"
          >
            {downloadLoading ? 'Generando PDF...' : 'Descargar PDF del día'}
          </button>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/admin/stock" className="underline">
            Volver al stock
          </Link>
          {' · '}
          <Link href="/admin/tickets-regalo" className="underline">
            Tickets regalo
          </Link>
        </p>
      </div>
    </main>
  );
}
