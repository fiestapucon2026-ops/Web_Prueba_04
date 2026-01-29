import Link from 'next/link';

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full bg-black border border-[#cc0000] rounded-lg p-8 shadow-[0_4px_12px_#ff9999] text-center">
        <div className="mb-6 text-5xl" aria-hidden>✓</div>
        <h1 className="text-2xl font-bold text-white mb-2">Pago exitoso</h1>
        <p className="text-gray-300 mb-6">
          Tu compra fue procesada correctamente. Revisa tu correo; te enviamos el ticket y los detalles de tu entrada.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/tickets"
            className="inline-block bg-[#cc0000] hover:bg-[#b30000] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Comprar más entradas
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
