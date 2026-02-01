'use client';

/**
 * DateSelector: Festival Dark Mode — strict black (#000000), 3-column date grid.
 * Accent: Neon Green (#39ff14) for Selected state.
 * DateCard: rectangle with day (top), month (bottom); states Idle / Hover / Selected / Sold Out.
 */

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

const HEART_DATES = new Set(['2026-02-13', '2026-02-14', '2026-02-15']);
const FLAG_DATES = new Set(['2026-02-20', '2026-02-21', '2026-02-22']);

export type DateCell = {
  date: string;
  day: string;
  dayName: string;
  specialIcon: 'heart' | 'flag' | null;
};

function buildDateGrid(): DateCell[][] {
  const dates = [
    ['2026-02-06', '2026-02-07', '2026-02-08'],
    ['2026-02-13', '2026-02-14', '2026-02-15'],
    ['2026-02-20', '2026-02-21', '2026-02-22'],
    ['2026-02-27', '2026-02-28', '2026-03-01'],
  ];
  return dates.map((row) =>
    row.map((date) => {
      const d = new Date(date + 'T12:00:00.000Z');
      const dayName = DAY_NAMES[d.getUTCDay()] ?? '';
      let specialIcon: 'heart' | 'flag' | null = null;
      if (HEART_DATES.has(date)) specialIcon = 'heart';
      else if (FLAG_DATES.has(date)) specialIcon = 'flag';
      return {
        date,
        day: date.slice(8, 10),
        dayName,
        specialIcon,
      };
    })
  );
}

const DATE_GRID = buildDateGrid();

const ACCENT_SELECTED = '#39ff14'; // Neon Green (borde estado seleccionado)

const DATE_RECTANGLE_COLORS: string[] = [
  '#99acff', '#bea1f7', '#cea8f0', '#e1a8f0', '#ff99d8', '#ffadad',
  '#ff9999', '#ffc099', '#ffd699', '#ffeb99', '#d3ff99', '#bfecac',
];

/** Retorna true si el color de fondo es claro (luminancia > 0.5). */
function isLightBackground(hex: string): boolean {
  const m = hex.slice(1).match(/.{2}/g);
  if (!m) return false;
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5;
}

export type DateSelectorProps = {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  soldOutDates?: Set<string>;
  /** Cuando true, no usa min-h-screen ni fondo; para usar dentro de card */
  insideCard?: boolean;
};

export function DateSelector({
  selectedDate,
  onSelectDate,
  soldOutDates = new Set(),
  insideCard = false,
}: DateSelectorProps) {
  return (
    <div
      className={`text-white font-sans ${insideCard ? 'p-4 md:p-6' : 'min-h-screen bg-black p-6 md:p-8'}`}
      style={insideCard ? undefined : { backgroundColor: '#000000' }}
    >
      <div className="mx-auto max-w-4xl">
        <h2 className="text-xl font-semibold text-white mb-6 text-center md:text-left">
          Elige tu fecha de Febrero 2026
        </h2>

        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {DATE_GRID.flat().map((cell, index) => {
            const isSelected = selectedDate === cell.date;
            const isSoldOut = soldOutDates.has(cell.date);
            const rectColor = DATE_RECTANGLE_COLORS[index] ?? DATE_RECTANGLE_COLORS[0];
            const useDarkText =
              !isSoldOut && (isSelected || isLightBackground(rectColor));

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => !isSoldOut && onSelectDate(cell.date)}
                disabled={isSoldOut}
                className={`
                  relative flex flex-col items-center justify-center rounded-lg min-h-[88px] md:min-h-[100px] border-2
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black
                  ${isSoldOut
                    ? 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed line-through'
                    : isSelected
                      ? 'border-[#39ff14] text-black font-bold focus:ring-[#39ff14]'
                      : 'border-white/20 text-white hover:border-white focus:ring-white/50'
                  }
                `}
                style={
                  isSoldOut
                    ? undefined
                    : { backgroundColor: isSelected ? ACCENT_SELECTED : rectColor }
                }
              >
                <span
                  className={`tabular-nums text-2xl md:text-3xl font-bold ${isSoldOut ? 'text-neutral-600' : useDarkText ? 'text-black' : 'text-white'}`}
                >
                  {cell.day}
                </span>
                <span
                  className={`text-xs font-bold uppercase tracking-wider mt-1 ${isSoldOut ? 'text-neutral-600' : useDarkText ? 'text-black/80' : 'text-white/90'}`}
                >
                  {cell.dayName}
                </span>
                {cell.specialIcon === 'heart' && (
                  <span
                    className="absolute top-1.5 right-1.5 text-sm"
                    title="Fechas especiales"
                    aria-hidden
                  >
                    ❤️
                  </span>
                )}
                {cell.specialIcon === 'flag' && (
                  <span
                    className="absolute top-1.5 right-1.5 text-sm"
                    title="Fechas especiales"
                    aria-hidden
                  >
                    🇨🇱
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
