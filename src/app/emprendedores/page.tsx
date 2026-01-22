import Link from 'next/link';

export default function Emprendedores() {
  return (
    <main className="min-h-screen bg-black text-white py-16 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center px-4 py-2 bg-black border border-[#cc0000] text-white rounded-lg hover:bg-[#cc0000] transition-colors duration-200"
          >
            ← Volver
          </Link>
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold mb-8 text-center">
          Emprendedores
        </h1>
        <div className="bg-black border border-[#cc0000] rounded-lg p-8 shadow-[0_4px_12px_#ff9999] min-h-[200px] flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-white mb-4">Tesoros Locales: El alma de la Araucanía en tus manos.</h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            No es solo una feria, es un encuentro con la historia viva. Aquí los emprendedores y artesanos reales de nuestra zona comparten contigo el patrimonio de la región. Cada pieza de artesanía, cada frasco de mermelada y cada objeto de charcutería es un Tesoro Local con identidad. Al llevarte uno, no compras un objeto: te llevas un pedazo del bosque, un secreto de familia y el esfuerzo de manos que mantienen viva nuestra cultura. Es Pucón auténtico, sin filtros.
          </p>
        </div>
      </div>
    </main>
  );
}
