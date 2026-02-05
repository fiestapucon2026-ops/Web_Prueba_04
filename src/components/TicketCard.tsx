'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const style = getCategoryStyle(ticket.category);
  const isFamiliar = /familiar/i.test(ticket.category.trim());

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(ticket.qr_token, { width: 200, margin: 1 }))
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticket.qr_token]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(ticket.qr_token).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }, [ticket.qr_token]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-xl border-2 ${style.bg} ${style.border} ${style.text} p-6 shadow-lg`}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-white p-3 text-center">
            <p className="text-xs font-medium opacity-80">Código de entrada</p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR de la entrada"
                className="mx-auto mt-2 h-40 w-40 rounded border border-slate-200"
                width={200}
                height={200}
              />
            ) : (
              <div className="mx-auto mt-2 h-40 w-40 animate-pulse rounded bg-slate-200" aria-hidden />
            )}
            <p className="mt-2 text-xs font-mono break-all select-all opacity-80">{ticket.qr_token}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2 rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
            >
              {copied ? 'Copiado' : 'Copiar código'}
            </button>
          </div>
          <div className="text-center sm:text-left">
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
      <p className="text-center text-sm text-slate-600">
        Presenta este código o el PDF enviado a tu correo al ingresar al evento.
      </p>
    </div>
  );
}
