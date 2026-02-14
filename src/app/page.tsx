import Image from 'next/image';
import Link from 'next/link';

const CTA_TEXT = 'PINCHA ACA PARA TUS TICKETS';

export default function Home() {
  return (
    <div className="relative min-h-screen text-white">
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/fondo1.png"
          alt="Fondo Festival"
          fill
          className="object-cover object-top"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)',
          }}
        />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-24 pb-12 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">
          GABRIEL MARIÁN (La ex voz de Rata Blanca VII)
        </h1>
        <p className="text-[1.9rem] sm:text-[2.3rem] text-[#ff3131] mb-3 font-semibold animate-unsolodia-blink">
          VIERNES 20 DE FEBRERO A PARTIR DE LAS 13:30
        </p>
        <p className="text-[1.3rem] sm:text-[1.45rem] text-white/80 mb-8">
          Lugar: Club de Rodeo Pucon
        </p>
        <Link
          href="/comprar"
          className="unsolodia-cta inline-block rounded-xl bg-[#39ff14] px-8 py-4 font-bold text-black hover:opacity-95 transition-opacity shadow-lg animate-unsolodia-pulse"
        >
          {CTA_TEXT}
        </Link>
      </main>

      {/* Sección Ubicación - vital para llegada al evento */}
      <section id="ubicacion" className="relative z-10 w-full bg-black/80 py-16 px-4 lg:px-8">
        <div className="bg-black border border-[#737373] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#a6a6a6] max-w-7xl mx-auto">
          <h2 className="text-center text-white text-3xl lg:text-4xl font-bold mb-12">
            Ubicación
          </h2>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            <div className="bg-black border border-[#737373] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#a6a6a6] h-full flex flex-col">
              <div className="space-y-6 text-white flex-1">
                <h3 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  Dirección
                </h3>
                <div className="space-y-4">
                  <p className="text-gray-300">
                    <strong>Coordenadas:</strong> 71° 55' 02" W - 39° 18' 14" S
                  </p>

                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold">Cómo llegar:</h4>

                    <div className="space-y-4 text-gray-300">
                      <div>
                        <p className="font-medium text-white mb-1">
                          Desde Villarrica / Pucón:
                        </p>
                        <p className="text-sm leading-relaxed">
                          Tomar la ruta hacia Caburgua, avanzar 1.400m después de ver la Pista de Aterrizaje a la izquierda,
                          y girar a la DERECHA hacia un camino de tierra.
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-white mb-1">
                          Desde Cordillera / Caburgua:
                        </p>
                        <p className="text-sm leading-relaxed">
                          Reducir velocidad después del Puente Trancura, avanzar 500m después de ver la Pista de Aterrizaje,
                          y girar a la IZQUIERDA con precaución.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 mt-auto">
                  <a
                    href="https://www.google.com/maps?q=-39.303889,-71.917222"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    <span>📍</span>
                    Abrir en Google Maps
                  </a>
                  <a
                    href="https://waze.com/ul?ll=-39.303889,-71.917222&navigate=yes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    <span>✈️</span>
                    Abrir en Waze
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-black border border-[#737373] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#a6a6a6] h-full flex flex-col">
              <div className="space-y-4 flex flex-col">
                <h3 className="text-2xl font-semibold text-white flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  Mapa
                </h3>
                <div className="w-full rounded-lg overflow-hidden border border-[#737373] bg-[#1a1a1a]" style={{ height: 400 }}>
                  <iframe
                    src="https://www.openstreetmap.org/export/embed.html?bbox=-71.93%2C-39.32%2C-71.90%2C-39.28&layer=mapnik&marker=-39.303889%2C-71.917222"
                    width="100%"
                    height="400"
                    style={{ border: 0, display: 'block' }}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    title="Ubicación Festival"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
