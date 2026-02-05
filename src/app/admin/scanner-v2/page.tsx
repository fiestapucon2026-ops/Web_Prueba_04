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
  const [lastResult, setLastResult] = useState<{ valid: boolean; msg: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<Notif>(null);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory', { credentials: 'include' });
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

  const handleValidation = useCallback(
    async (uuid: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setLastResult(null);
      setNotification(null);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        setNotification({ type: 'error', message: 'Formato QR inválido (No es UUID)' });
        setIsProcessing(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/tickets/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ qr_uuid: uuid }),
        });

        const data = (await res.json()) as { valid?: boolean; message?: string };
        if (res.status === 401) {
          setAuthenticated(false);
          setNotification({ type: 'error', message: 'Sesión expirada' });
          setIsProcessing(false);
          return;
        }

        if (data.valid) {
          setLastResult({ valid: true, msg: '¡ACCESO PERMITIDO!' });
          setNotification({ type: 'success', message: 'Entrada válida' });
          new Audio('/sounds/success.mp3').play().catch(() => {});
        } else {
          setLastResult({ valid: false, msg: data.message ?? 'Entrada rechazada' });
          setNotification({ type: 'error', message: data.message ?? 'Error' });
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
        </div>
      )}

      {lastResult ? (
        <div
          className={`w-full max-w-md p-8 rounded-2xl text-center shadow-2xl mb-6 ${
            lastResult.valid ? 'bg-green-600' : 'bg-red-600'
          } text-white`}
        >
          <div className="text-6xl mb-4">{lastResult.valid ? '✅' : '⛔'}</div>
          <h2 className="text-3xl font-bold uppercase">{lastResult.msg}</h2>
          <button
            type="button"
            onClick={resetScanner}
            className="mt-8 bg-white text-black px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform"
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
