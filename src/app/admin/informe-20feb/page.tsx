'use client';

import { useCallback, useEffect, useState } from 'react';

type ReportRow = {
  tipo: 'Entrada' | 'Estacionamiento' | 'PROMO';
  vendidos: number;
  valorizado: number;
};

type ReportData = {
  event_date: string;
  event_label: string;
  generated_at: string;
  by_type: ReportRow[];
  total_vendidos: number;
  total_valorizado: number;
};

function formatReportDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function Informe20FebPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/reports/tickets-20feb');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error || 'Error al cargar el informe');
        return;
      }
      const json = (await res.json()) as ReportData;
      setData(json);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Informe 20 de febrero</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => fetchReport()}
            className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
          >
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12 text-white flex items-center justify-center">
        <p className="text-slate-400">Cargando informe...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-10 print:py-6">
        <div className="border-b border-gray-300 pb-4 mb-6 print:mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Festival Pucón 2026</h1>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-1">
          Informe de tickets vendidos y regalados
        </h2>
        <p className="text-gray-600 mb-1">Evento: {data.event_label}</p>
        <p className="text-sm text-gray-500 mb-8">
          Fecha y hora del informe: {formatReportDateTime(data.generated_at)}
        </p>

        <table className="w-full border-collapse border border-gray-300 text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-3 font-semibold">Tipo</th>
              <th className="border border-gray-300 px-4 py-3 font-semibold text-right">Vendidos</th>
              <th className="border border-gray-300 px-4 py-3 font-semibold text-right">Valorizado (CLP)</th>
            </tr>
          </thead>
          <tbody>
            {data.by_type.map((row) => (
              <tr key={row.tipo} className="border-b border-gray-200">
                <td className="border border-gray-300 px-4 py-3">{row.tipo}</td>
                <td className="border border-gray-300 px-4 py-3 text-right">{row.vendidos}</td>
                <td className="border border-gray-300 px-4 py-3 text-right">
                  ${row.valorizado.toLocaleString('es-CL')}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="border border-gray-300 px-4 py-3">Total</td>
              <td className="border border-gray-300 px-4 py-3 text-right">{data.total_vendidos}</td>
              <td className="border border-gray-300 px-4 py-3 text-right">
                ${data.total_valorizado.toLocaleString('es-CL')}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-sm text-gray-700">
          Nota: Son valores con IVA y no incluye el descuento de Mercado Pago por usar su sistema.
        </p>

        <p className="mt-8 text-xs text-gray-500 print:mt-6">
          Documento generado hasta {formatReportDateTime(data.generated_at)}. Solo uso interno.
        </p>
      </div>
    </main>
  );
}
