export default function MusicaEnVivo() {
  return (
    <main className="min-h-screen bg-black text-white py-16 px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl lg:text-5xl font-bold mb-8 text-center">
          Música en Vivo
        </h1>
        <div className="bg-black border border-[#cc0000] rounded-lg p-8 shadow-[0_4px_12px_#ff9999]">
          <p className="text-gray-300 text-lg">
            Aquí encontrarás toda la información sobre los artistas y bandas que estarán presentes en el Festival Pucón.
          </p>
          <p className="text-gray-400 text-sm mt-4">
            Próximamente: Programación completa, fotografías y más información.
          </p>
        </div>
      </div>
    </main>
  );
}
