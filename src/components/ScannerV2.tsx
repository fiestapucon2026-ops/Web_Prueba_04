'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

// CONFIGURACIÓN CRÍTICA: Ruta absoluta del worker para evitar problemas de base path
function getWorkerPath(): string {
  if (typeof window === 'undefined') return '/workers/qr-scanner-worker.min.js';
  return `${window.location.origin}/workers/qr-scanner-worker.min.js`;
}

interface ScannerV2Props {
  onScan: (data: string) => void;
  onError?: (msg: string) => void;
}

export default function ScannerV2({ onScan, onError }: ScannerV2Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [status, setStatus] = useState<'init' | 'scanning' | 'error'>('init');

  useEffect(() => {
    if (!videoRef.current) return;

    if (typeof window !== 'undefined') {
      (QrScanner as unknown as { WORKER_PATH: string }).WORKER_PATH = getWorkerPath();
      console.log('Worker Path configurado:', (QrScanner as unknown as { WORKER_PATH: string }).WORKER_PATH);
    }

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        scanner.stop();
        onScan(result.data.trim());
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
        returnDetailedScanResult: true,
        calculateScanRegion: (video) => ({
          x: 0,
          y: 0,
          width: video.videoWidth,
          height: video.videoHeight,
          downScaledWidth: 1024,
        }),
      }
    );

    scannerRef.current = scanner;
    scanner.setInversionMode('both');

    scanner
      .start()
      .then(() => setStatus('scanning'))
      .catch((err) => {
        console.error('Error cámara:', err);
        setStatus('error');
        if (onError) onError(err instanceof Error ? err.message : 'Error de cámara');
      });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [onScan, onError]);

  return (
    <div className="relative w-full max-w-md aspect-square mx-auto bg-black rounded-xl overflow-hidden border-2 border-slate-800 shadow-2xl">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

      {status === 'init' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-20">
          <span className="animate-pulse">Iniciando óptica...</span>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none border-[30px] border-black/30 z-10">
        <div className="w-full h-full border-2 border-white/20 relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-yellow-400" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-yellow-400" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-yellow-400" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400" />
        </div>
      </div>
    </div>
  );
}
