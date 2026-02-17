'use client';

import { useCallback, useEffect, useState } from 'react';
import ScannerV2 from '@/components/ScannerV2';
import ManualEntryV2 from '@/components/ManualEntryV2';

type Notif = { type: 'success' | 'error'; message: string } | null;

export default function ScannerPageV2() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  type ResultKind = 'access_ok' | 'already_used' | 'invalid_qr' | 'valid_other_day';
  const [lastResult, setLastResult] = useState<{ kind: ResultKind; msg: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<Notif>(null);
  const [lastRawDecoded, setLastRawDecoded] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/check', { credentials: 'include' });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      setAuthenticated(res.ok);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const UUID_STRICT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const UUID_MATCH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  const handleValidation = useCallback(
    async (raw: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setLastResult(null);
      setNotification(null);

      const trimmed = raw.trim().replace(/\s+/g, '');
      let uuid = trimmed;
      if (!UUID_STRICT.test(uuid)) {
        const extracted = trimmed.match(UUID_MATCH)?.[0];
        if (extracted) uuid = extracted;
      }
      if (!UUID_STRICT.test(uuid)) {
        console.warn('[ScannerV2] QR decodificado no es UUID. Raw:', JSON.stringify(raw));
        setLastRawDecoded(raw.length > 80 ? raw.slice(0, 80) + '…' : raw);
        setNotification({ type: 'error', message: 'Formato QR inválido (No es UUID)' });
        setIsProcessing(false);
        return;
      }
      setLastRawDecoded(null);

      try {
        const res = await fetch('/api/admin/tickets/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ qr_uuid: uuid.trim() }),
        });

        const data = (await res.json()) as { valid?: boolean; message?: string };
        if (res.status === 401) {
          setAuthenticated(false);
          setNotification({ type: 'error', message: 'Sesión expirada' });
          setIsProcessing(false);
          return;
        }

        const apiMsg = (data.message ?? '').trim();
        if (data.valid) {
          setLastResult({ kind: 'access_ok', msg: '¡ACCESO PERMITIDO!' });
          setNotification({ type: 'success', message: 'Entrada válida' });
          new Audio('/sounds/success.mp3').play().catch(() => {});
        } else if (apiMsg === 'Entrada ya utilizada') {
          setLastResult({ kind: 'already_used', msg: 'ENTRADA YA UTILIZADA' });
          setNotification({ type: 'error', message: 'Entrada ya utilizada' });
          navigator.vibrate?.([200, 100, 200]);
        } else if (apiMsg === 'Válido para otro día') {
          setLastResult({ kind: 'valid_other_day', msg: 'QR VALIDO PERO PARA OTRO DIA' });
          setNotification({ type: 'error', message: 'Válido para otro día' });
          navigator.vibrate?.([200, 100, 200]);
        } else {
          setLastResult({ kind: 'invalid_qr', msg: 'QR NO VALIDO' });
          setNotification({ type: 'error', message: apiMsg || 'Entrada no válida' });
          navigator.vibrate?.([200, 100, 200]);
        }
      } catch {
        setNotification({ type: 'error', message: 'Error de red' });
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing]
  );

  const resetScanner = useCallback(() => {
    setLastResult(null);
    setNotification(null);
    setLastRawDecoded(null);
    setIsProcessing(false);
  }, []);

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
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setLastResult(null);
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
      <main className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Control de Acceso V2</h1>
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3">
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

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <div className="w-full max-w-md flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Control de Acceso V2</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded"
        >
          Cerrar sesión
        </button>
      </div>

      {notification && (
        <div
          className={`w-full max-w-md mb-4 p-3 rounded text-sm ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {notification.message}
          {notification.type === 'error' && lastRawDecoded && (
            <p className="mt-2 text-xs font-mono break-all opacity-90">Leído: {lastRawDecoded}</p>
          )}
        </div>
      )}

      {lastResult ? (
        <div
          className={`w-full max-w-md p-8 rounded-2xl text-center shadow-2xl mb-6 ${
            lastResult.kind === 'valid_other_day' ? 'bg-amber-400 text-black' : 'text-white ' + (
              lastResult.kind === 'access_ok'
                ? 'bg-green-600'
                : lastResult.kind === 'already_used'
                  ? 'bg-red-600'
                  : 'bg-purple-600'
            )
          }`}
        >
          <div className="text-6xl mb-4">
            {lastResult.kind === 'access_ok' ? '✅' : lastResult.kind === 'already_used' ? '⛔' : lastResult.kind === 'invalid_qr' ? '🚫' : '📅'}
          </div>
          <h2 className="text-3xl font-bold uppercase">{lastResult.msg}</h2>
          <button
            type="button"
            onClick={resetScanner}
            className={`mt-8 px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform ${
              lastResult.kind === 'valid_other_day' ? 'bg-gray-900 text-white' : 'bg-white text-black'
            }`}
          >
            ESCANEAR SIGUIENTE
          </button>
        </div>
      ) : (
        <div className="w-full">
          <ScannerV2 onScan={handleValidation} onError={(msg) => setNotification({ type: 'error', message: msg })} />
          <ManualEntryV2 onSubmit={handleValidation} />
          <div className="text-center mt-8 text-xs text-gray-400">
            Versión de Motor: qr-scanner 1.4.2 (Worker Mode) — URL de prueba: /admin/scanner-v2
          </div>
        </div>
      )}
    </main>
  );
}
