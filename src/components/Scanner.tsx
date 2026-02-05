'use client';

import { useEffect, useRef } from 'react';
import QrScanner from 'qr-scanner';

interface ScannerProps {
  onScanSuccess: (data: string) => void;
  onCameraError?: (err: unknown) => void;
}

export default function Scanner({ onScanSuccess, onCameraError }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanSuccessRef = useRef(onScanSuccess);

  onScanSuccessRef.current = onScanSuccess;

  useEffect(() => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    const scanner = new QrScanner(
      videoElem,
      (result) => {
        scanner.stop();
        onScanSuccessRef.current(result.data.trim());
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 10,
        returnDetailedScanResult: true,
      }
    );

    scanner.start().catch((err) => {
      onCameraError?.(err);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [onCameraError]);

  return (
    <div className="relative w-full aspect-square overflow-hidden bg-black rounded-xl border-2 border-slate-600">
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
    </div>
  );
}
