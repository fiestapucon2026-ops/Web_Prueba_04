import Link from 'next/link';

export default function PendingPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full bg-black border border-[#737373] rounded-lg p-8 shadow-[0_4px_12px_#a6a6a6] text-center">
        <div className="mb-6 text-5xl text-amber-400" aria-hidden>⏳</div>
        <h1 className="text-2xl font-bold text-white mb-2">Pago pendiente</h1>
        <p className="text-gray-300 mb-6">
          Tu pago está pendiente (por ejemplo, transferencia o pago en efectivo). Cuando Mercado Pago confirme el pago, te enviaremos las entradas por correo.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/entradas"
            className="inline-block bg-[#cc0000] hover:bg-[#b30000] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Ver entradas
          </Link>
          <Link
            href="/"
            className="inline-block border border-[#737373] hover:border-[#a6a6a6] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
