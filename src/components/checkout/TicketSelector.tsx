'use client';

import React, { useState, useEffect } from 'react';
import type { EntradasInventoryItem } from '@/app/api/entradas/inventory/route';

const MAX_MAIN_QUANTITY = 8;

export type MainTicket = {
  ticket_type_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type ParkingTicket = {
  ticket_type_id: string;
  name: string;
  price: number;
};

export type PromoTicket = {
  ticket_type_id: string;
  name: string;
  price: number;
  quantity: number; // 1 hasta cantidad de entradas (máx. 1 promo por entrada)
};

export type EntradasCart = {
  mainTicket: MainTicket | null;
  parking: ParkingTicket | null;
  promoTicket: PromoTicket | null;
};

export type TicketSelectorProps = {
  inventoryData: EntradasInventoryItem[];
  selectedDateLabel: string;
  cart: EntradasCart;
  onCartChange: (cart: EntradasCart) => void;
  disabled?: boolean;
};

function getMainTickets(inventory: EntradasInventoryItem[]): EntradasInventoryItem[] {
  return inventory.filter(
    (i) => i.name === 'Familiar' || i.name === 'Todo el Día' || i.name === 'Todo el día'
  );
}

function getParkingTickets(inventory: EntradasInventoryItem[]): EntradasInventoryItem[] {
  return inventory.filter(
    (i) =>
      i.name === 'Estacionamiento Familiar' || i.name === 'Estacionamiento Todo el día'
  );
}

function getPromoTickets(inventory: EntradasInventoryItem[]): EntradasInventoryItem[] {
  return inventory.filter((i) => i.name.includes('Promo'));
}

export function TicketSelector({
  inventoryData,
  selectedDateLabel,
  cart,
  onCartChange,
  disabled = false,
}: TicketSelectorProps) {
  const mainTickets = getMainTickets(inventoryData);
  const parkingTickets = getParkingTickets(inventoryData);
  const promoTickets = getPromoTickets(inventoryData);

  // Declaración mayoría de edad para promo (alcohol): null = no preguntado, true = sí, false = no
  const [legalAgeForPromo, setLegalAgeForPromo] = useState<null | true | false>(null);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [pendingPromoItem, setPendingPromoItem] = useState<EntradasInventoryItem | null>(null);
  // Parpadeo amarillo cada 1,5 s en botón Promo cuando no está elegido
  const [promoHighlightYellow, setPromoHighlightYellow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setPromoHighlightYellow((v) => !v), 1500);
    return () => clearInterval(t);
  }, []);

  // Parpadeo cada 1 s para "¡ÚLTIMAS UNIDADES!" (apagar/encender)
  const [lastUnitsBlink, setLastUnitsBlink] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setLastUnitsBlink((v) => !v), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSelectMain = (item: EntradasInventoryItem) => {
    const isSelected = cart.mainTicket?.ticket_type_id === item.ticket_type_id;
    if (isSelected) return;
    onCartChange({
      ...cart,
      mainTicket: { ticket_type_id: item.ticket_type_id, name: item.name, price: item.price, quantity: 1 },
    });
  };

  const handleMainQty = (delta: number) => {
    if (!cart.mainTicket) return;
    const next = Math.max(1, Math.min(MAX_MAIN_QUANTITY, cart.mainTicket.quantity + delta));
    let promoTicket = cart.promoTicket;
    if (promoTicket && promoTicket.quantity > next) {
      promoTicket = { ...promoTicket, quantity: next };
    }
    onCartChange({
      ...cart,
      mainTicket: { ...cart.mainTicket, quantity: next },
      promoTicket: promoTicket ?? cart.promoTicket,
    });
  };

  const handleSelectParking = (item: EntradasInventoryItem | null) => {
    onCartChange({
      ...cart,
      parking: item
        ? { ticket_type_id: item.ticket_type_id, name: item.name, price: item.price }
        : null,
    });
  };

  const maxPromoQty = cart.mainTicket ? cart.mainTicket.quantity : 0;
  const promoBlockedByAge = legalAgeForPromo === false;

  const handleClickPromo = (item: EntradasInventoryItem) => {
    if (legalAgeForPromo === true) {
      onCartChange({
        ...cart,
        promoTicket: cart.promoTicket?.ticket_type_id === item.ticket_type_id
          ? null
          : { ticket_type_id: item.ticket_type_id, name: item.name, price: item.price, quantity: 0 },
      });
      return;
    }
    if (legalAgeForPromo === false) return; // botón deshabilitado
    setPendingPromoItem(item);
    setShowAgeModal(true);
  };

  const handleAgeDeclare = (accept: boolean) => {
    setShowAgeModal(false);
    if (accept) {
      setLegalAgeForPromo(true);
      if (pendingPromoItem) {
        onCartChange({
          ...cart,
          promoTicket: {
            ticket_type_id: pendingPromoItem.ticket_type_id,
            name: pendingPromoItem.name,
            price: pendingPromoItem.price,
            quantity: 0,
          },
        });
        setPendingPromoItem(null);
      }
    } else {
      setLegalAgeForPromo(false);
      setPendingPromoItem(null);
    }
  };

  const handlePromoQty = (delta: number) => {
    if (!cart.promoTicket || !cart.mainTicket) return;
    const next = Math.max(0, Math.min(maxPromoQty, cart.promoTicket.quantity + delta));
    onCartChange({
      ...cart,
      promoTicket: { ...cart.promoTicket, quantity: next },
    });
  };

  const total =
    (cart.mainTicket ? cart.mainTicket.price * cart.mainTicket.quantity : 0) +
    (cart.parking ? cart.parking.price : 0) +
    (cart.promoTicket ? cart.promoTicket.price * cart.promoTicket.quantity : 0);

  return (
    <div className="space-y-6 text-white">
      <h3 className="text-lg font-semibold">
        Elige tus tickets para el {selectedDateLabel}
      </h3>

      {/* Entrada: Familiar o Todo el Día (solo uno) */}
      <div>
        <p className="mb-2 text-sm font-medium text-white/90">Elige uno</p>
        <div className="flex flex-wrap gap-3">
          {mainTickets.map((item) => {
            const isSelected = cart.mainTicket?.ticket_type_id === item.ticket_type_id;
            const isSoldOut = item.available_stock < 1;
            const showLastUnits =
              !isSoldOut &&
              item.fomo_threshold > 0 &&
              (item.occupied_pct >= item.fomo_threshold || item.fomo_threshold >= 100);
            return (
              <button
                key={item.ticket_type_id}
                type="button"
                disabled={disabled || isSoldOut}
                onClick={() => handleSelectMain(item)}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                    : isSoldOut
                      ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                      : 'border-white/30 bg-white/5 text-white hover:border-white/50'
                }`}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-semibold">{item.name}</span>
                  {(item.name === 'Familiar' && (
                    <span className="text-xs text-white/80">(Ingreso de 12:30 a 17:00 hrs)</span>
                  )) ||
                    ((item.name === 'Todo el Día' || item.name === 'Todo el día') && (
                      <span className="text-xs text-white/80">(ingreso de 12:30 a 23:00 hrs)</span>
                    ))}
                </div>
                <span className="mt-1 block text-sm">
                  {item.price === 0 ? (
                    <span className="rounded bg-green-700/80 px-2 py-0.5 font-bold text-green-100">
                      ¡HOY GRATIS!
                    </span>
                  ) : (
                    `$${item.price.toLocaleString('es-CL')} CLP`
                  )}
                </span>
                {isSoldOut && (
                  <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                    AGOTADOS
                  </span>
                )}
                {showLastUnits && (
                  <span
                    className={`ml-2 inline-block rounded bg-amber-600/70 px-2 py-0.5 text-xs font-medium text-amber-100 transition-opacity ${lastUnitsBlink ? 'opacity-100' : 'opacity-0'}`}
                    style={{ minWidth: '9.5rem' }}
                  >
                    ¡ÚLTIMAS UNIDADES!
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {cart.mainTicket && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-white/80">Cantidad:</span>
            <button
              type="button"
              disabled={disabled || cart.mainTicket.quantity <= 1}
              onClick={() => handleMainQty(-1)}
              className="h-8 w-8 rounded border border-white/30 bg-white/10 text-white disabled:opacity-50"
              aria-label="Menos"
            >
              −
            </button>
            <span className="min-w-[2rem] text-center font-medium">{cart.mainTicket.quantity}</span>
            <button
              type="button"
              disabled={disabled || cart.mainTicket.quantity >= MAX_MAIN_QUANTITY}
              onClick={() => handleMainQty(1)}
              className="h-8 w-8 rounded border border-white/30 bg-white/10 text-white disabled:opacity-50"
              aria-label="Más"
            >
              +
            </button>
            <span className="text-sm text-white/70">(máx. {MAX_MAIN_QUANTITY})</span>
          </div>
        )}
      </div>

      {/* Estacionamiento: Normal, VIP o Sin vehículo (solo uno) */}
      <div>
        <p className="mb-2 text-sm font-medium text-white/90">Estacionamiento</p>
        <div className="flex flex-wrap gap-3">
          {/* Opción virtual: Sin vehículo (sin valor) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectParking(null)}
            className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
              cart.parking === null
                ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                : 'border-white/30 bg-white/5 text-white hover:border-white/50'
            }`}
          >
            <span className="font-semibold">Sin vehículo</span>
          </button>
          {parkingTickets.map((item) => {
            const isSelected = cart.parking?.ticket_type_id === item.ticket_type_id;
            const isSoldOut = item.available_stock < 1;
            const showLastUnits =
              !isSoldOut &&
              item.fomo_threshold > 0 &&
              (item.occupied_pct >= item.fomo_threshold || item.fomo_threshold >= 100);
            return (
              <button
                key={item.ticket_type_id}
                type="button"
                disabled={disabled || isSoldOut}
                onClick={() => handleSelectParking(isSelected ? null : item)}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                    : isSoldOut
                      ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                      : 'border-white/30 bg-white/5 text-white hover:border-white/50'
                }`}
              >
                <span className="font-semibold">
                  {item.name.replace(/^Estacionamiento\s+/, '')}
                </span>
                <span className="ml-2 text-sm">
                  {item.price === 0 ? (
                    <span className="rounded bg-green-700/80 px-2 py-0.5 font-bold text-green-100">
                      ¡HOY GRATIS!
                    </span>
                  ) : (
                    `$${item.price.toLocaleString('es-CL')} CLP`
                  )}
                </span>
                {isSoldOut && (
                  <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                    AGOTADOS
                  </span>
                )}
                {showLastUnits && (
                  <span
                    className={`ml-2 inline-block rounded bg-amber-600/70 px-2 py-0.5 text-xs font-medium text-amber-100 transition-opacity ${lastUnitsBlink ? 'opacity-100' : 'opacity-0'}`}
                    style={{ minWidth: '9.5rem' }}
                  >
                    ¡ÚLTIMAS UNIDADES!
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-white/60">Sólo puedes comprar un estacionamiento.</p>
      </div>

      {/* Promos (opcional): máx. 1 por entrada; declaración mayoría de edad obligatoria */}
      {promoTickets.length > 0 && cart.mainTicket && (
        <div>
          <p className="mb-1 text-sm font-medium text-white/90">
            ¿Quieres agregar promoción? Incluye el Ecovaso oficial del Festival Pucón 2026 de 500 cc.
          </p>
          <p className="mb-2 text-xs text-white/70">(máx. {maxPromoQty} = 1 por entrada)</p>
          {promoBlockedByAge && (
            <p className="mb-2 text-sm text-amber-200">
              Para agregar esta promoción debes declarar que eres mayor de edad.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {promoTickets.map((item) => {
              const isSelected = cart.promoTicket?.ticket_type_id === item.ticket_type_id;
              const isSoldOut = item.available_stock < 1;
              const isDisabled = disabled || isSoldOut || promoBlockedByAge;
              const showLastUnits =
                !item.name.includes('Promo') &&
                !isSoldOut &&
                item.fomo_threshold > 0 &&
                (item.occupied_pct >= item.fomo_threshold || item.fomo_threshold >= 100);
              const showPromoBlink = !isSelected && !isDisabled;
              return (
                <button
                  key={item.ticket_type_id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleClickPromo(item)}
                  className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                      : isDisabled
                        ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                        : showPromoBlink && promoHighlightYellow
                          ? 'border-[#ffbd59] bg-[#ffbd59]/25 text-white'
                          : 'border-white/30 bg-white/5 text-white hover:border-white/50'
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="ml-2 text-sm">
                    {item.price === 0 ? (
                      <span className="rounded bg-green-700/80 px-2 py-0.5 font-bold text-green-100">
                        ¡HOY GRATIS!
                      </span>
                    ) : (
                      `$${item.price.toLocaleString('es-CL')} CLP`
                    )}
                  </span>
                  {isSoldOut && (
                    <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                      AGOTADOS
                    </span>
                  )}
                  {showLastUnits && !isDisabled && (
                    <span
                      className={`ml-2 inline-block rounded bg-amber-600/70 px-2 py-0.5 text-xs font-medium text-amber-100 transition-opacity ${lastUnitsBlink ? 'opacity-100' : 'opacity-0'}`}
                      style={{ minWidth: '9.5rem' }}
                    >
                      ¡ÚLTIMAS UNIDADES!
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {promoBlockedByAge && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setLegalAgeForPromo(true)}
                className="rounded border border-amber-500 bg-amber-600/30 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-600/50"
              >
                Acepto y declaro ser mayor de edad (SÍ)
              </button>
            </div>
          )}
          {cart.promoTicket && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-white/80">Cantidad promo:</span>
              <button
                type="button"
                disabled={disabled || cart.promoTicket.quantity <= 0}
                onClick={() => handlePromoQty(-1)}
                className="h-8 w-8 rounded border border-white/30 bg-white/10 text-white disabled:opacity-50"
                aria-label="Menos promo"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center font-medium">{cart.promoTicket.quantity}</span>
              <button
                type="button"
                disabled={disabled || cart.promoTicket.quantity >= maxPromoQty}
                onClick={() => handlePromoQty(1)}
                className="h-8 w-8 rounded border border-white/30 bg-white/10 text-white disabled:opacity-50"
                aria-label="Más promo"
              >
                +
              </button>
              <span className="text-sm text-white/70">(Es uno por ticket: Máx {maxPromoQty})</span>
            </div>
          )}
        </div>
      )}

      {/* Modal: declaración mayoría de edad (promo alcohol) */}
      {showAgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/20 bg-neutral-800 p-6 text-center shadow-xl">
            <p className="mb-4 text-base font-medium text-white">
              Acepto y declaro ser mayor de edad
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => handleAgeDeclare(true)}
                className="rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700"
              >
                SÍ
              </button>
              <button
                type="button"
                onClick={() => handleAgeDeclare(false)}
                className="rounded-lg border border-neutral-500 bg-neutral-700 px-5 py-2.5 font-semibold text-white hover:bg-neutral-600"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="border-t border-white/20 pt-4">
        <p className="text-lg font-semibold">
          Total: ${total.toLocaleString('es-CL')} CLP
        </p>
      </div>
    </div>
  );
}
