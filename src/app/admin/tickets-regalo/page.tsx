'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Notif = { type: 'success' | 'error'; message: string } | null;
type GiftKind = 'entrada' | 'estacionamiento' | 'promo';
type GiftOption = {
  kind: GiftKind;
  ticket_type_name: string;
  available_stock: number;
};

function todayChile(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .slice(0, 10);
}

export default function TicketsRegaloPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [giftDate, setGiftDate] = useState(todayChile());
  const [giftKind, setGiftKind] = useState<GiftKind>('entrada');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftOptions, setGiftOptions] = useState<GiftOption[]>([]);
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMessage, setGiftMessage] = useState<Notif>(null);
  const [lastAccessToken, setLastAccessToken] = useState<string | null>(null);
  const giftMessageRef = useRef<HTMLDivElement>(null);

  const TICKETS_REGALO_TOKEN_KEY = 'tickets_regalo_last_token';

  // #region agent log
  useEffect(() => {
    if (lastAccessToken) {
      fetch('http://127.0.0.1:7242/ingest/b6986c15-cff9-4156-9370-473ee8d4c21f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tickets-regalo/page.tsx:useEffect lastAccessToken',
          message: 'links block should render',
          data: { hypothesisId: 'C', hasToken: true },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
  }, [lastAccessToken]);
  // #endregion

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem(TICKETS_REGALO_TOKEN_KEY);
    if (saved) setLastAccessToken(saved);
  }, []);

  const loadGiftOptions = useCallback(async () => {
    if (!isAdmin) return;
    setGiftLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/gifts?date=${encodeURIComponent(giftDate)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { options?: GiftOption[]; error?: string };
      if (!res.ok) {
        setGiftOptions([]);
        setGiftMessage({ type: 'error', message: data.error || 'No se pudieron cargar opciones de regalo' });
        return;
      }
      setGiftOptions(Array.isArray(data.options) ? data.options : []);
      setGiftMessage(null);
    } catch {
      setGiftOptions([]);
      setGiftMessage({ type: 'error', message: 'Error de red cargando opciones de regalo' });
    } finally {
      setGiftLoading(false);
    }
  }, [giftDate, isAdmin]);

  useEffect(() => {
    if (authenticated && isAdmin) {
      loadGiftOptions();
    }
  }, [authenticated, isAdmin, loadGiftOptions]);

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
        const secretLen = res.headers.get('X-Admin-Secret-Len');
        const providedLen = res.headers.get('X-Admin-Provided-Len');
        let msg: string;
        try {
          const data = (await res.json()) as { error?: string };
          msg = data?.error ?? '';
        } catch {
          msg = '';
        }
        if (secretLen !== null && providedLen !== null) {
          const s = Number(secretLen);
          const p = Number(providedLen);
          if (s === 0) msg = 'Servidor sin ADMIN_SECRET. Configurar en Vercel (Production) y redeploy.';
          else if (s !== p) msg = `Longitud incorrecta: ${p} vs ${s} caracteres.`;
          else if (!msg) msg = 'Clave incorrecta.';
        }
        setLoginError(msg || 'Clave incorrecta');
        return;
      }
      if (!res.ok) {
        setLoginError('Error al iniciar sesión');
        return;
      }
      setInputKey('');
      await checkAuth();
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setGiftLoading(true);
    setGiftMessage(null);
    setLastAccessToken(null);
    try {
      const res = await fetch('/api/admin/tickets/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          date: giftDate,
          kind: giftKind,
          quantity: giftQuantity,
        }),
      });
      let data: {
        ok?: boolean;
        message?: string;
        error?: string;
        created?: number;
        access_token?: string;
        pdf_base64?: string;
        pdf_error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setGiftMessage({
          type: 'error',
          message: `Error ${res.status}: ${res.statusText}. La respuesta no es JSON.`,
        });
        giftMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (!res.ok) {
        const msg = data?.error || `Error ${res.status}: no se pudieron crear tickets regalo.`;
        setGiftMessage({ type: 'error', message: msg });
        giftMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (data.pdf_base64) {
        try {
          const binary = atob(data.pdf_base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'tickets-regalo.pdf';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Descarga PDF:', e);
        }
      }
      if (data.pdf_error) {
        setGiftMessage({
          type: 'success',
          message: `${data.message ?? 'Tickets creados.'} Si no se descargó el PDF, usa el enlace "Descargar PDF" abajo. (Error técnico: ${data.pdf_error})`,
        });
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6986c15-cff9-4156-9370-473ee8d4c21f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tickets-regalo/page.tsx:POST response',
          message: 'gifts POST success',
          data: { hypothesisId: 'A', ok: data?.ok, hasAccessToken: !!data?.access_token, created: data?.created },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const token = data.access_token ?? null;
      setLastAccessToken(token);
      if (token && typeof window !== 'undefined') sessionStorage.setItem(TICKETS_REGALO_TOKEN_KEY, token);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6986c15-cff9-4156-9370-473ee8d4c21f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tickets-regalo/page.tsx:setLastAccessToken',
          message: 'state update',
          data: { hypothesisId: 'B', tokenSet: !!data?.access_token },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setGiftMessage({
        type: 'success',
        message: `${data.message || 'Tickets regalo creados'}: ${data.created ?? giftQuantity}`,
      });
      giftMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await loadGiftOptions();
    } catch (err) {
      setGiftMessage({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error de red al crear tickets regalo',
      });
      giftMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setGiftLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setIsAdmin(false);
  };

  if (authenticated === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Verificando sesión...</p>
      </main>
    );
  }

  if (authenticated === false) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Tickets de regalo</h1>
        <p className="text-sm text-gray-600 mb-4">Solo administradores (clave ADMIN_SECRET). Uso en computador de escritorio.</p>
        <form onSubmit={handleLogin} className="w-full space-y-3">
          <label className="block text-sm font-medium text-gray-700">Clave de acceso</label>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="Clave"
          />
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2 rounded font-medium disabled:opacity-50"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center max-w-md mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Tickets de regalo</h1>
        <p className="text-gray-600 mb-4">Solo administradores. Inicia sesión con la clave ADMIN_SECRET.</p>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded"
        >
          Cerrar sesión
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tickets de regalo</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <p className="text-sm text-gray-500">
          La fecha debe ser un día con evento en la base de datos (event_days). Entrada, Estacionamiento o PROMO.
        </p>
        <form onSubmit={handleCreateGifts} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={giftDate}
              onChange={(e) => setGiftDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={giftKind}
              onChange={(e) => setGiftKind(e.target.value as GiftKind)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="entrada">Entrada</option>
              <option value="estacionamiento">Estacionamiento</option>
              <option value="promo">PROMO</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              type="number"
              min={1}
              max={100}
              value={giftQuantity}
              onChange={(e) => setGiftQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={giftLoading}
            className="w-full rounded bg-gray-900 text-white py-2 font-semibold disabled:opacity-50"
          >
            {giftLoading ? 'Procesando...' : 'Generar tickets regalo'}
          </button>
        </form>

        <button
          type="button"
          onClick={loadGiftOptions}
          disabled={giftLoading}
          className="w-full rounded border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Actualizar disponibilidad
        </button>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Disponibilidad por tipo</p>
          {giftOptions.length === 0 ? (
            <p className="text-sm text-gray-500">Sin datos para la fecha seleccionada.</p>
          ) : (
            giftOptions.map((o, idx) => (
              <div key={`${o.kind}-${o.ticket_type_name}-${idx}`} className="rounded border border-gray-200 p-2 text-sm">
                <p className="font-medium text-gray-800">{o.ticket_type_name}</p>
                <p className="text-gray-600">
                  Tipo: {o.kind.toUpperCase()} | Disponible: {o.available_stock}
                </p>
              </div>
            ))
          )}
        </div>

        {giftMessage && (
          <div
            ref={giftMessageRef}
            className={`rounded p-3 text-sm ${
              giftMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
            role="alert"
          >
            {giftMessage.message}
          </div>
        )}

        {lastAccessToken && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-800">Ver o descargar tickets (válido 24 h):</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`/mis-entradas?token=${encodeURIComponent(lastAccessToken)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
              >
                Ver tickets en pantalla
              </a>
              <a
                href={`/api/orders/by-reference/pdf?token=${encodeURIComponent(lastAccessToken)}`}
                target="_blank"
                rel="noopener noreferrer"
                download="tickets-regalo.pdf"
                className="inline-flex items-center justify-center rounded border border-gray-700 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Descargar PDF
              </a>
            </div>
            <p className="text-xs text-gray-500">Si recargaste la página, los enlaces se restauran desde esta sesión.</p>
          </div>
        )}
      </div>
    </main>
  );
}
