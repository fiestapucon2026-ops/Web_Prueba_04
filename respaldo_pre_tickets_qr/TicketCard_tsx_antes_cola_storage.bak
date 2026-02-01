'use client';

import { useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import type { TicketCardData } from '@/types/ticket';

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  VIP: { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900' },
  Familiar: { bg: 'bg-emerald-50', border: 'border-emerald-600', text: 'text-emerald-900' },
  General: { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-900' },
};

function getCategoryStyle(category: string): { bg: string; border: string; text: string } {
  const normalized = category.trim();
  if (CATEGORY_STYLES[normalized]) return CATEGORY_STYLES[normalized];
  if (/vip/i.test(normalized)) return CATEGORY_STYLES.VIP;
  if (/familiar/i.test(normalized)) return CATEGORY_STYLES.Familiar;
  return CATEGORY_STYLES.General;
}

interface TicketCardProps {
  ticket: TicketCardData;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const style = getCategoryStyle(ticket.category);
  const isFamiliar = /familiar/i.test(ticket.category.trim());

  const handleDownload = useCallback(() => {
    const node = cardRef.current;
    if (!node) return;
    toPng(node, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
    })
      .then((dataUrl: string) => {
        download(dataUrl, `entrada-${ticket.uuid.slice(0, 8)}.png`, 'image/png');
      })
      .catch((err: unknown) => {
        console.error('Error capturing ticket image:', err);
      });
  }, [ticket.uuid]);

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={cardRef}
        className={`rounded-xl border-2 ${style.bg} ${style.border} ${style.text} p-6 shadow-lg`}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex-shrink-0 rounded-lg bg-white p-3">
            <QRCode
              value={ticket.qr_token}
              size={160}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
            />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-medium opacity-80">ID entrada</p>
            <p className="font-mono text-sm break-all">{ticket.uuid}</p>
            <p className="mt-2 text-sm font-medium opacity-80">Categoría</p>
            <p className="text-xl font-bold">{ticket.category}</p>
            {ticket.access_window && (
              <>
                <p className="mt-2 text-sm font-medium opacity-80">Acceso</p>
                <p className="text-base">{ticket.access_window}</p>
              </>
            )}
            {isFamiliar && (
              <p className="mt-3 rounded-md bg-amber-200 px-3 py-2 text-sm font-semibold text-amber-900">
                ⚠️ Válido hasta 17:00
              </p>
            )}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
      >
        Guardar Entrada
      </button>
    </div>
  );
}
