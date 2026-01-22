import Link from 'next/link';

export default function MusicaEnVivo() {
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
          Música en Vivo
        </h1>
        <div className="bg-black border border-[#cc0000] rounded-lg p-8 shadow-[0_4px_12px_#ff9999] min-h-[200px] flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-white mb-4">Line-up: El pulso del Sur bajo las estrellas.</h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            Las tardes en Pucón tienen un nuevo ritmo. Todos los viernes, sábados y domingos, el escenario se enciende con la fuerza de nuestra tierra. Déjate llevar por la nostalgia y la energía de "SAN MIGUEL", el tributo definitivo a Los Prisioneros, o baila hasta que el cuerpo aguante con todo el sabor de "LOS TIGRES DEL SUR". Durante todo enero y febrero, hemos curado una selección con los mejores exponentes de la música chilena. Es el momento de cerrar los ojos, levantar tu vaso de cerveza artesanal y sentir que la música, finalmente, suena a vacaciones.
          </p>
        </div>
      </div>
    </main>
  );
}
