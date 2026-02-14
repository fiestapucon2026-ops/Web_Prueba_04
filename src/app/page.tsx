import Image from 'next/image';
import Link from 'next/link';

const CTA_TEXT = 'PINCHA ACA PARA TUS TICKETS';

export default function Home() {
  return (
    <div className="relative min-h-screen text-white overflow-hidden">
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
    </div>
  );
}
