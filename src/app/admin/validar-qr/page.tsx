'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ValidateResult = {
  valid: boolean;
  message: string;
  ticket_id?: string;
};

const MAX_SCANS_PER_SECOND = 12;

/** Escanear todo el frame (mejor lectura a distintas distancias). Mantiene proporción al redimensionar. */
function fullFrameScanRegion(video: HTMLVideoElement) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const max = 800;
  const scale = Math.min(1, max / Math.max(w, h));
  return {
    x: 0,
    y: 0,
    width: w,
    height: h,
    downScaledWidth: Math.round(w * scale),
    downScaledHeight: Math.round(h * scale),
  };
}

export default function AdminValidarQrPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [useFileFallback, setUseFileFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<InstanceType<typeof import('qr-scanner').default> | null>(null);
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

  const handleDecoded = useCallback(
    async (data: string) => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
      setValidating(true);
      setResult(null);
      try {
        const r = await validateQrUuid(data);
        setResult(r);
      } finally {
        setValidating(false);
      }
    },
    [validateQrUuid]
  );

  useEffect(() => {
    if (authenticated !== true || useFileFallback || result !== null) return;
    const video = videoRef.current;
    if (!video) return;

    let mounted = true;
    let scanner: InstanceType<typeof import('qr-scanner').default> | null = null;

    const init = async () => {
      try {
        const QrScanner = (await import('qr-scanner')).default;
        const hasCam = await QrScanner.hasCamera();
        if (!mounted || !hasCam) {
          setCameraError('No se detectó cámara. Usa "Subir imagen".');
          setUseFileFallback(true);
          return;
        }
        scanner = new QrScanner(
          video,
          (scanResult) => {
            const text = typeof scanResult === 'string' ? scanResult : scanResult.data;
            if (text && mounted) handleDecoded(text);
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: MAX_SCANS_PER_SECOND,
            returnDetailedScanResult: true,
            calculateScanRegion: fullFrameScanRegion,
          }
        );
        scannerRef.current = scanner;
        scanner.setInversionMode('both');
        await scanner.start();
        if (mounted) {
          setCameraReady(true);
          setCameraError(null);
        }
      } catch (err) {
        if (mounted) {
          setCameraError('No se pudo usar la cámara. Usa "Subir imagen" como respaldo.');
          setUseFileFallback(true);
        }
      }
    };

    init();
    return () => {
      mounted = false;
      if (scanner) {
        scanner.stop();
        scanner.destroy();
      }
      scannerRef.current = null;
      setCameraReady(false);
    };
  }, [authenticated, useFileFallback, handleDecoded, result]);

  const handleValidarOtro = useCallback(() => {
    setResult(null);
    setCameraError(null);
    if (useFileFallback) {
      fileInputRef.current?.click();
      return;
    }
    setCameraReady(false);
    const video = videoRef.current;
    if (video && !scannerRef.current) {
      import('qr-scanner').then(({ default: QrScanner }) => {
        const scanner = new QrScanner(
          video,
          (scanResult) => {
            const text = typeof scanResult === 'string' ? scanResult : scanResult.data;
            if (text) handleDecoded(text);
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: MAX_SCANS_PER_SECOND,
            returnDetailedScanResult: true,
            calculateScanRegion: fullFrameScanRegion,
          }
        );
        scannerRef.current = scanner;
        scanner.setInversionMode('both');
        scanner.start().then(() => setCameraReady(true));
      });
    }
  }, [useFileFallback, handleDecoded]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setResult(null);
      setValidating(true);
      try {
        const QrScanner = (await import('qr-scanner')).default;
        const scanResult = await QrScanner.scanImage(file, {
          returnDetailedScanResult: true,
        });
        const data = typeof scanResult === 'string' ? scanResult : scanResult.data;
        const r = await validateQrUuid(data);
        setResult(r);
      } catch {
        setResult({
          valid: false,
          message: 'No se encontró un QR en la imagen. Prueba otra.',
        });
      } finally {
        setValidating(false);
      }
    },
    [validateQrUuid]
  );

  const handleLogout = async () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
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
        ) : useFileFallback ? (
          <div className="space-y-3">
            {cameraError && (
              <p className="rounded-lg bg-amber-900/30 border border-amber-700 px-3 py-2 text-sm text-amber-200">
                {cameraError}
              </p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={validating}
              className="w-full rounded-xl border-2 border-dashed border-slate-500 bg-slate-800/50 px-4 py-10 text-slate-200 hover:border-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              <span className="block text-base font-medium">Subir imagen con QR</span>
              <span className="mt-1 block text-sm text-slate-400">
                Toca para tomar foto o elegir imagen
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-slate-600 bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                playsInline
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <p className="text-slate-400">Iniciando cámara...</p>
                </div>
              )}
            </div>
            <p className="text-center text-sm text-slate-400">
              Apunta al QR de la entrada. No se guarda ninguna foto.
            </p>
            <button
              type="button"
              onClick={() => { setUseFileFallback(true); setCameraError(null); }}
              className="w-full rounded-lg border border-slate-600 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Usar imagen en su lugar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
