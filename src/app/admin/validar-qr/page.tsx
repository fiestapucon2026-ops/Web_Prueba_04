'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ValidateResult = {
  valid: boolean;
  message: string;
  ticket_id?: string;
};

export default function AdminValidarQrPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory', { credentials: 'include' });
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
    } catch {
      setLoginError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

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

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setResult(null);
      setValidating(true);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const placeholderId = 'qr-file-placeholder';
        let el = document.getElementById(placeholderId);
        if (!el) {
          el = document.createElement('div');
          el.id = placeholderId;
          el.setAttribute('aria-hidden', 'true');
          el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
          document.body.appendChild(el);
        }
        const scanner = new Html5Qrcode(placeholderId);
        const decoded = await scanner.scanFile(file, false);
        const r = await validateQrUuid(decoded);
        setResult(r);
      } catch {
        setResult({ valid: false, message: 'No se pudo leer el QR. Enfoca bien el código o sube otra imagen.' });
      } finally {
        setValidating(false);
      }
    },
    [validateQrUuid]
  );

  const handleValidarOtro = useCallback(() => {
    setResult(null);
    fileInputRef.current?.click();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setResult(null);
  };

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
          <h1 className="mb-6 text-xl font-bold text-white">
            Validar entrada QR
          </h1>
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
            {loginError && (
              <p className="text-sm text-red-400">{loginError}</p>
            )}
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          disabled={validating}
        />

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
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={validating}
            className="w-full rounded-xl border-2 border-dashed border-slate-500 bg-slate-800/50 px-4 py-12 text-slate-200 hover:border-slate-400 hover:bg-slate-800 disabled:opacity-50"
          >
            <span className="block text-base font-medium">Escanear QR</span>
            <span className="mt-1 block text-sm text-slate-400">
              Toca para tomar foto o elegir imagen
            </span>
          </button>
        )}
      </div>
    </main>
  );
}
