'use client';

import { useCallback, useEffect, useState } from 'react';
import Scanner from '@/components/Scanner';

type ValidateResult = {
  valid: boolean;
  message: string;
  ticket_id?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AdminValidarQrPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/check', { credentials: 'include' });
      if (res.status === 401) {
        setAuthenticated(false);
        return false;
      }
      if (!res.ok) return false;
      setAuthenticated(true);
      return true;
    } catch {
      setAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const validateQrUuid = useCallback(async (qrUuid: string): Promise<ValidateResult> => {
    const res = await fetch('/api/admin/tickets/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ qr_uuid: qrUuid.trim() }),
    });
    const data = (await res.json()) as ValidateResult & { error?: string };
    if (res.status === 401) {
      setAuthenticated(false);
      return { valid: false, message: 'Sesión expirada' };
    }
    if (data.valid === true) {
      return { valid: true, message: data.message, ticket_id: data.ticket_id };
    }
    return { valid: false, message: data.message ?? data.error ?? 'Error al validar' };
  }, []);

  const handleScan = useCallback(
    async (data: string) => {
      const trimmed = data.trim();
      if (!UUID_REGEX.test(trimmed)) {
        setResult({
          valid: false,
          message: 'El código no tiene formato de entrada válido (UUID).',
        });
        return;
      }
      setValidating(true);
      setResult(null);
      try {
        const r = await validateQrUuid(trimmed);
        setResult(r);
      } finally {
        setValidating(false);
      }
    },
    [validateQrUuid]
  );

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

  const handleCameraError = useCallback(() => {
    setCameraError('No se pudo iniciar la cámara. Revisa los permisos del navegador.');
  }, []);

  const handleValidarOtro = useCallback(() => {
    setResult(null);
    setCameraError(null);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setResult(null);
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (authenticated === null) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Verificando sesión...</p>
      </main>
    );
  }

  if (authenticated === false) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12">
        <div className="mx-auto max-w-sm">
          <h1 className="mb-6 text-xl font-bold text-white">Validar entrada QR</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-key" className="mb-1 block text-sm text-slate-300">
                Clave de acceso
              </label>
              <input
                id="admin-key"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="Clave"
                autoComplete="current-password"
              />
            </div>
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-6 text-white">
      <div className="mx-auto max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Validar entrada</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>

        {validating && (
          <p className="mb-4 text-center text-slate-400">Validando...</p>
        )}

        {result !== null ? (
          <div
            className={`rounded-xl border px-4 py-5 text-center ${
              result.valid
                ? 'border-green-600 bg-green-900/30 text-green-200'
                : 'border-red-600 bg-red-900/30 text-red-200'
            }`}
          >
            <p className="font-semibold">
              {result.valid ? 'Entrada válida' : 'Entrada rechazada'}
            </p>
            <p className="mt-1 text-sm">{result.message}</p>
            <button
              type="button"
              onClick={handleValidarOtro}
              className="mt-4 w-full rounded-lg bg-slate-700 py-2.5 text-sm font-medium hover:bg-slate-600"
            >
              Escanear otra entrada
            </button>
          </div>
        ) : cameraError ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-700 bg-amber-900/30 px-4 py-6 text-center">
              <p className="text-amber-200">{cameraError}</p>
              <p className="mt-2 text-sm text-slate-400">
                En el navegador, permite el acceso a la cámara para este sitio y recarga la página.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Scanner onScanSuccess={handleScan} onCameraError={handleCameraError} />
            <p className="text-center text-sm text-slate-400">
              Enfoca el QR del otro celular en el recuadro.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
