'use client';

import Image from 'next/image';

export default function PantallaInicio() {
  return (
    <main className="relative w-full min-h-[200vh] bg-black overflow-hidden">
      {/* Imagen de Fondo - Full Width */}
      <div className="relative w-full h-screen">
        <Image
          src="/images/fondo1.png"
          alt="Fondo Festival"
          fill
          className="object-cover object-top"
          priority
          sizes="100vw"
        />
        
        {/* Overlay con degradado: 100% transparente arriba → 80% negro abajo */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: 'linear-gradient(to bottom, transparent 0%, transparent 25%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)'
          }}
        />

        {/* Logo redondo: centrado en el ancho, bajo el volcán, arriba de "Festival Pucón 2026". Espacio entre logo y frase reservado para futuro botón "Compra tus entradas". */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center z-40 pointer-events-none pb-4">
          <div className="w-full flex flex-col items-center justify-center pointer-events-auto">
            {/* Espacio superior sin logo */}
            <div className="h-14 sm:h-16 md:h-20" aria-hidden />
            {/* Frase "Festival Pucón 2026" */}
            <div className="w-3/4 flex items-center justify-center">
              <Image
                src="/images/Festival1.png"
                alt="Festival Pucón 2026"
                width={1200}
                height={200}
                className="w-full h-auto object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sección Ubicación - Ventana Madre */}
      <div id="ubicacion" className="w-full bg-black py-16 px-4 lg:px-8">
        {/* Contenedor Padre con borde gris y sombra gris */}
        <div className="bg-black border border-[#737373] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#a6a6a6] max-w-7xl mx-auto">
          <h2 className="text-center text-white text-3xl lg:text-4xl font-bold mb-12">
            Ubicación
          </h2>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            {/* Columna Izquierda - Dirección */}
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

                {/* Botones */}
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

            {/* Columna Derecha - Mapa */}
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
                <p className="text-gray-400 text-sm">
                  Si no ves el mapa:{' '}
                  <a
                    href="https://www.openstreetmap.org/?mlat=-39.303889&mlon=-71.917222#map=15/-39.303889/-71.917222"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 underline"
                  >
                    Abrirlo en OpenStreetMap
                  </a>
                  {' · '}
                  <a
                    href="https://www.google.com/maps?q=-39.303889,-71.917222"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-red-300 underline"
                  >
                    Abrirlo en Google Maps
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - RUCAMANQUE PRODUCCION */}
      <div className="w-full bg-black py-8 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500 text-xs text-center">
            RUCAMANQUE PRODUCCION
          </p>
        </div>
      </div>
    </main>
  );
}
