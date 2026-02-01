'use client';

import dynamic from 'next/dynamic';
import type { TicketCardData } from '@/types/ticket';

const TicketCard = dynamic(
  () => import('@/components/TicketCard').then((m) => m.TicketCard),
  { ssr: false }
);

export { TicketCard };
export type { TicketCardData };
