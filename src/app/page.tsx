'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const CTA_TEXT = 'PINCHA ACA PARA TUS TICKETS';

export default function Home() {
  const [isProgramOpen, setIsProgramOpen] = useState(false);
  const [isGabrielOpen, setIsGabrielOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProgramOpen(false);
        setIsGabrielOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
        <button
          type="button"
          onClick={() => setIsProgramOpen(true)}
          className="mt-4 inline-block rounded-xl px-8 py-3 font-bold text-black transition-transform hover:scale-[1.02]"
          style={{
            backgroundColor: '#ffd21f',
            border: '2px solid #1fff93',
            fontFamily: '"Open Sans", Arial, Helvetica, sans-serif',
          }}
        >
          🎸 PROGRAMA
        </button>
        <button
          type="button"
          onClick={() => setIsGabrielOpen(true)}
          className="mt-3 inline-block rounded-xl px-8 py-3 font-bold text-black transition-transform hover:scale-[1.02]"
          style={{
            backgroundColor: '#ffd21f',
            border: '2px solid #1fff93',
            fontFamily: '"Open Sans", Arial, Helvetica, sans-serif',
          }}
        >
          Gabriel Marián
        </button>
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

      {isProgramOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setIsProgramOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/25 bg-black/65 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.55)] text-white p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Programa del evento"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                PUCÓN ROCK LEGENDS: EL VIAJE DE TU VIDA
              </h2>
              <button
                type="button"
                onClick={() => setIsProgramOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-black hover:opacity-95"
                style={{ backgroundColor: '#ffd21f', border: '2px solid #1fff93' }}
              >
                Volver
              </button>
            </div>

            <div className="space-y-6 text-white">
              <section className="rounded-xl border border-white/15 bg-white/5 p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-extrabold text-white mb-2">
                  13:00 hrs | EL DESPEGUE: CERVEZA, FUEGO Y AMIGOS
                </h3>
                <p className="text-white/90 leading-relaxed">
                  Las puertas se abren para los que saben que el rock empieza con el primer brindis.
                  Cerveza artesanal helada, sushi de autor, hamburguesas que alimentan el alma y el sol de Pucón.
                  Elige tu lugar, el viaje está por comenzar.
                </p>
              </section>

              <section className="rounded-xl border border-white/15 bg-white/5 p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-extrabold text-white mb-2">
                  16:30 hrs | KILLER QUEEN: EL REY NO HA MUERTO
                </h3>
                <p className="text-white/90 leading-relaxed">
                  No es solo un tributo, es volver a Wembley '86. Cierra los ojos y siente cómo
                  &quot;Bohemian Rhapsody&quot; detiene el tiempo. La mística de Freddie renace para recordarte
                  que la realeza es eterna. Un show para los que aún sienten escalofríos con un &quot;Ay-Oh!&quot;.
                </p>
              </section>

              <section className="rounded-xl border border-white/15 bg-white/5 p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-extrabold text-white mb-2">
                  18:30 hrs | FUSIÓN ESTELAR: LA GLORIA DE LOS 80s
                </h3>
                <p className="text-white/90 leading-relaxed">
                  Esa dosis de adrenalina que te hace falta. Bon Jovi en estado puro. Es volver a esa carretera,
                  a ese primer beso, a esa rebeldía. &quot;Livin&apos; on a Prayer&quot; no es una canción, es el grito
                  de una generación que se niega a envejecer. ¡Calentamos motores para el estallido final!
                </p>
              </section>

              <section className="rounded-xl border border-white/15 bg-white/5 p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-extrabold text-white mb-2">
                  20:30 hrs | EL CIERRE: GABRIEL MARIÁN (LA VOZ DE UNA ERA)
                </h3>
                <p className="text-white/90 leading-relaxed">
                  Cuando la noche cae, la voz que marcó el rock en español toma el control. Gabriel Marián nos lleva
                  de vuelta al corazón de Rata Blanca VII. Prepárate para detonar con &quot;Ella&quot; y dejar la garganta
                  en cada verso de &quot;Mujer Amante&quot;. No es un concierto, es la comunión con la leyenda.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      {isGabrielOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setIsGabrielOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/25 bg-black/65 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.55)] text-white p-4 md:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Video de Gabriel Marián"
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Gabriel Marián te invita a su show
              </h2>
              <button
                type="button"
                onClick={() => setIsGabrielOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-bold text-black hover:opacity-95"
                style={{ backgroundColor: '#ffd21f', border: '2px solid #1fff93' }}
              >
                Volver
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/20 bg-black">
              <video
                src="/videos/gabriel-marian.mp4"
                controls
                playsInline
                preload="metadata"
                className="w-full h-auto max-h-[70vh]"
              >
                Tu navegador no soporta la reproducción de video.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
