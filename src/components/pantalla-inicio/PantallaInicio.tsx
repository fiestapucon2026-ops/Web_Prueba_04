import Image from 'next/image';
import Link from 'next/link';

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

        {/* Imagen "Festival1.png" en último 1/4 de altura */}
        <div className="absolute bottom-0 left-0 right-0 h-1/4 flex flex-col items-center justify-center z-40 pointer-events-none">
          <div className="w-3/4 flex items-center justify-center pointer-events-auto">
            <Image
              src="/images/Festival1.png"
              alt="Festival Pucón 2026"
              width={1200}
              height={200}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
          {/* Botón "...como llegar" */}
          <div className="mt-4 pointer-events-auto">
            <a
              href="#ubicacion"
              className="inline-block bg-black text-[#ffadad] border border-[#ff2828] px-6 py-3 rounded-lg shadow-[0_4px_12px_#ffd6d6] hover:bg-[#1a1a1a] transition-colors duration-200 font-medium"
            >
              ...como llegar
            </a>
          </div>
        </div>
      </div>

      {/* Logo - Posicionado en Superior Derecha SOBRE la imagen */}
      <div className="absolute top-0 right-0 p-6 lg:p-8 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <Image
            src="/images/Logo Negro 3 sin fondo chico.png"
            alt="Logo Festival"
            width={200}
            height={200}
            className="w-auto h-auto max-w-[250px] lg:max-w-[300px]"
            priority
          />
        </div>
      </div>

      {/* Sección Información - Ventanas (Debajo de foto, arriba de Ubicación) */}
      <div className="w-full bg-black py-16 px-4 lg:px-8">
        {/* Contenedor Padre */}
        <div className="bg-black border border-[#cc0000] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#ff9999] max-w-7xl mx-auto">
          {/* Grid de 4 Ventanas Hijas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Ventana 1: Resumen - ID: ventana-evento */}
            <div id="ventana-evento" className="bg-black border border-[#cc0000] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#ff9999] h-full relative overflow-hidden group">
              {/* Imagen por defecto */}
              <div className="absolute inset-0 group-hover:hidden">
                <Image
                  src="/images/Evento.png"
                  alt="El Evento"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Texto que aparece al hover */}
              <div className="hidden group-hover:block relative z-10">
                <h3 className="text-2xl font-semibold text-white mb-4">El Evento: Respira. Estás en el Festival Pucón.</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  ¿Sientes eso? Es el sonido del viento entre los árboles nativos, no el de una bocina. A solo minutos del centro, pero a un mundo de distancia del caos, te esperan 4.5 hectáreas de libertad. Olvida la odisea de buscar dónde dejar tu auto; nuestro estacionamiento privado te recibe para que tu única preocupación sea decidir por dónde empezar. Aquí, la naturaleza no es el paisaje, es tu anfitriona. Un ambiente seguro, amplio y diseñado para quienes saben que el verdadero lujo es la tranquilidad.
                </p>
              </div>
            </div>

            {/* Ventana 2: Música en Vivo - DESACTIVADA */}
            <div className="bg-black border border-[#cc0000] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#ff9999] h-full relative overflow-hidden group">
              {/* Imagen por defecto */}
              <div className="absolute inset-0 group-hover:hidden">
                <Image
                  src="/images/Musica en vivo.png"
                  alt="Música en Vivo"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Texto que aparece al hover */}
              <div className="hidden group-hover:block relative z-10">
                <h3 className="text-2xl font-semibold text-white mb-4">Line-up: El pulso del Sur bajo las estrellas.</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Las tardes en Pucón tienen un nuevo ritmo. Todos los viernes, sábados y domingos, el escenario se enciende con la fuerza de nuestra tierra. Déjate llevar por la nostalgia y la energía de "SAN MIGUEL", el tributo definitivo a Los Prisioneros, o baila hasta que el cuerpo aguante con todo el sabor de "LOS TIGRES DEL SUR". Durante todo enero y febrero, hemos curado una selección con los mejores exponentes de la música chilena. Es el momento de cerrar los ojos, levantar tu vaso de cerveza artesanal y sentir que la música, finalmente, suena a vacaciones.
                </p>
              </div>
            </div>

            {/* Ventana 3: Emprendedores - DESACTIVADA */}
            <div className="bg-black border border-[#cc0000] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#ff9999] h-full relative overflow-hidden group">
              {/* Imagen por defecto */}
              <div className="absolute inset-0 group-hover:hidden">
                <Image
                  src="/images/Emprendedores.png"
                  alt="Emprendedores"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Texto que aparece al hover */}
              <div className="hidden group-hover:block relative z-10">
                <h3 className="text-2xl font-semibold text-white mb-4">Tesoros Locales: El alma de la Araucanía en tus manos.</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  No es solo una feria, es un encuentro con la historia viva. Aquí los emprendedores y artesanos reales de nuestra zona comparten contigo el patrimonio de la región. Cada pieza de artesanía, cada frasco de mermelada y cada objeto de charcutería es un Tesoro Local con identidad. Al llevarte uno, no compras un objeto: te llevas un pedazo del bosque, un secreto de familia y el esfuerzo de manos que mantienen viva nuestra cultura. Es Pucón auténtico, sin filtros.
                </p>
              </div>
            </div>

            {/* Ventana 4: Actividades - DESACTIVADA */}
            <div className="bg-black border border-[#cc0000] rounded-lg p-6 lg:p-8 shadow-[0_4px_12px_#ff9999] h-full relative overflow-hidden group">
              {/* Imagen por defecto */}
              <div className="absolute inset-0 group-hover:hidden">
                <Image
                  src="/images/Actividades.png"
                  alt="Actividades"
                  fill
                  className="object-cover"
                />
              </div>
              {/* Texto que aparece al hover */}
              <div className="hidden group-hover:block relative z-10">
                <h3 className="text-2xl font-semibold text-white mb-4">Experiencias: Libertad para ellos, paz para ti.</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Sabemos que tus hijos tienen energía acumulada tras horas de viaje o filas en el centro. En el Festival Pucón, el recinto es 100% seguro y cerrado, diseñado para que ellos vuelvan a correr por el pasto, participen en concursos y rían con el karaoke mientras tú los vigilas de lejos con un asado costumbrista en la mesa. Desde juegos pensados para los más pequeños hasta desafíos para adolescentes, este es el lugar donde ellos crean sus mejores recuerdos de verano... y tú, finalmente, logras descansar.
                </p>
              </div>
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
              <div className="space-y-4 h-full flex flex-col">
                <h3 className="text-2xl font-semibold text-white flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  Mapa
                </h3>
                <div className="w-full flex-1 rounded-lg overflow-hidden border border-[#737373]">
                  <iframe
                    src="https://www.google.com/maps?q=-39.303889,-71.917222&hl=es&z=15&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación Festival"
                  />
                </div>
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
