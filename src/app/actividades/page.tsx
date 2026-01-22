import Link from 'next/link';

export default function Actividades() {
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
          Actividades
        </h1>
        <div className="bg-black border border-[#cc0000] rounded-lg p-8 shadow-[0_4px_12px_#ff9999] min-h-[200px] flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-white mb-4">Experiencias: Libertad para ellos, paz para ti.</h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            Sabemos que tus hijos tienen energía acumulada tras horas de viaje o filas en el centro. En el Festival Pucón, el recinto es 100% seguro y cerrado, diseñado para que ellos vuelvan a correr por el pasto, participen en concursos y rían con el karaoke mientras tú los vigilas de lejos con un asado costumbrista en la mesa. Desde juegos pensados para los más pequeños hasta desafíos para adolescentes, este es el lugar donde ellos crean sus mejores recuerdos de verano... y tú, finalmente, logras descansar.
          </p>
        </div>
      </div>
    </main>
  );
}
