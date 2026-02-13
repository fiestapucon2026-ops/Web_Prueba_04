'use client';

import React, { useState, useEffect } from 'react';
import type { EntradasCart } from './TicketSelector';

export type UnSoloDiaInventoryItem = {
  ticket_type_id: string;
  name: string;
  price: number;
  nominal_stock: number;
  available_stock: number;
  total_capacity: number;
};

const MAX_MAIN_QUANTITY = 8;
const DATE_LABEL = 'Viernes 20 de febrero';

export type TicketSelector2Props = {
  inventoryData: UnSoloDiaInventoryItem[];
  cart: EntradasCart;
  onCartChange: (cart: EntradasCart) => void;
  disabled?: boolean;
};

function getGeneralItem(inventory: UnSoloDiaInventoryItem[]): UnSoloDiaInventoryItem | null {
  return inventory.find((i) => i.name === 'Tickets') ?? null;
}

function getParkingItem(inventory: UnSoloDiaInventoryItem[]): UnSoloDiaInventoryItem | null {
  return inventory.find((i) => i.name === 'Estacionamiento') ?? null;
}

function getPromoItem(inventory: UnSoloDiaInventoryItem[]): UnSoloDiaInventoryItem | null {
  return inventory.find((i) => i.name === 'Promo') ?? null;
}

export function TicketSelector_2({
  inventoryData,
  cart,
  onCartChange,
  disabled = false,
}: TicketSelector2Props) {
  const generalItem = getGeneralItem(inventoryData);
  const parkingItem = getParkingItem(inventoryData);
  const promoItem = getPromoItem(inventoryData);

  const [legalAgeForPromo, setLegalAgeForPromo] = useState<null | true | false>(null);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [pendingPromoAdd, setPendingPromoAdd] = useState(false);
  const [promoHighlightYellow, setPromoHighlightYellow] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPromoHighlightYellow((v) => !v), 1500);
    return () => clearInterval(t);
  }, []);

  const maxPromoQty = cart.mainTicket ? cart.mainTicket.quantity : 0;
  const promoBlockedByAge = legalAgeForPromo === false;

  const handleSelectGeneral = () => {
    if (!generalItem || generalItem.available_stock < 1) return;
    onCartChange({
      ...cart,
      mainTicket: {
        ticket_type_id: generalItem.ticket_type_id,
        name: 'Tickets General',
        price: generalItem.price,
        quantity: 1,
      },
      parking: cart.parking,
      promoTicket: cart.promoTicket ? { ...cart.promoTicket, quantity: Math.min(cart.promoTicket.quantity, 1) } : null,
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

  const handleSelectParking = (withParking: boolean) => {
    if (!parkingItem && withParking) return;
    onCartChange({
      ...cart,
      parking: withParking && parkingItem
        ? { ticket_type_id: parkingItem.ticket_type_id, name: parkingItem.name, price: parkingItem.price }
        : null,
    });
  };

  const handleClickPromo = () => {
    if (legalAgeForPromo === true) {
      if (cart.promoTicket?.ticket_type_id === promoItem?.ticket_type_id) {
        onCartChange({ ...cart, promoTicket: null });
      } else if (promoItem) {
        onCartChange({
          ...cart,
          promoTicket: {
            ticket_type_id: promoItem.ticket_type_id,
            name: 'Promo 2x1 Cerveza Artesanal (2 x 500 cc)',
            price: promoItem.price,
            quantity: 0,
          },
        });
      }
      return;
    }
    if (legalAgeForPromo === false) return;
    setPendingPromoAdd(true);
    setShowAgeModal(true);
  };

  const handleAgeDeclare = (accept: boolean) => {
    setShowAgeModal(false);
    if (accept && promoItem) {
      setLegalAgeForPromo(true);
      if (pendingPromoAdd) {
        onCartChange({
          ...cart,
          promoTicket: {
            ticket_type_id: promoItem.ticket_type_id,
            name: 'Promo 2x1 Cerveza Artesanal (2 x 500 cc)',
            price: promoItem.price,
            quantity: 0,
          },
        });
      }
      setPendingPromoAdd(false);
    } else {
      setLegalAgeForPromo(false);
      setPendingPromoAdd(false);
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

  const generalSoldOut = !generalItem || generalItem.available_stock < 1;
  const parkingSoldOut = !parkingItem || parkingItem.available_stock < 1;
  const promoSoldOut = !promoItem || promoItem.available_stock < 1;

  return (
    <div className="space-y-6 text-white">
      <h3 className="text-lg font-semibold">
        Elige tus tickets para el {DATE_LABEL}
      </h3>

      {/* Tickets General (máx. 8) */}
      <div>
        <p className="mb-2 text-sm font-medium text-white/90">Tickets General</p>
        {generalItem && (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                disabled={disabled || generalSoldOut}
                onClick={handleSelectGeneral}
                className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                  cart.mainTicket
                    ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                    : generalSoldOut
                      ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                      : 'border-white/30 bg-white/5 text-white hover:border-white/50'
                }`}
              >
                <span className="font-semibold">Tickets General</span>
                <span className="mt-1 block text-sm">
                  ${generalItem.price.toLocaleString('es-CL')} CLP
                </span>
                {generalSoldOut && (
                  <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                    AGOTADOS
                  </span>
                )}
              </button>
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
          </>
        )}
      </div>

      {/* Estacionamiento: 1 o Sin vehículo */}
      <div>
        <p className="mb-2 text-sm font-medium text-white/90">Estacionamiento</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectParking(false)}
            className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
              cart.parking === null && cart.mainTicket
                ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                : 'border-white/30 bg-white/5 text-white hover:border-white/50'
            }`}
          >
            <span className="font-semibold">Sin vehículo</span>
          </button>
          {parkingItem && (
            <button
              type="button"
              disabled={disabled || parkingSoldOut}
              onClick={() => handleSelectParking(true)}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                cart.parking?.ticket_type_id === parkingItem.ticket_type_id
                  ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                  : parkingSoldOut
                    ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                    : 'border-white/30 bg-white/5 text-white hover:border-white/50'
              }`}
            >
              <span className="font-semibold">Estacionamiento</span>
              <span className="ml-2 text-sm">
                ${parkingItem.price.toLocaleString('es-CL')} CLP
              </span>
              {parkingSoldOut && (
                <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                  AGOTADOS
                </span>
              )}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-white/60">Solo un estacionamiento por compra.</p>
      </div>

      {/* Promo: Ecovaso + 2x1 Cerveza, máx. N = N tickets */}
      {promoItem && cart.mainTicket && (
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
            <button
              type="button"
              disabled={disabled || promoSoldOut || promoBlockedByAge}
              onClick={handleClickPromo}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                cart.promoTicket?.ticket_type_id === promoItem.ticket_type_id
                  ? 'border-[#39ff14] bg-[#39ff14]/20 text-white'
                  : disabled || promoSoldOut || promoBlockedByAge
                    ? 'cursor-not-allowed border-neutral-600 bg-neutral-800 text-neutral-500'
                    : !cart.promoTicket && promoHighlightYellow
                      ? 'border-[#ffbd59] bg-[#ffbd59]/25 text-white'
                      : 'border-white/30 bg-white/5 text-white hover:border-white/50'
              }`}
            >
              <span className="font-semibold">Promo 2x1 Cerveza Artesanal (2 x 500 cc)</span>
              <span className="ml-2 text-sm">
                ${promoItem.price.toLocaleString('es-CL')} CLP
              </span>
              {promoSoldOut && (
                <span className="ml-2 rounded bg-red-900/60 px-2 py-0.5 text-xs font-medium text-red-200">
                  AGOTADOS
                </span>
              )}
            </button>
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
              <span className="text-sm text-white/70">(Máx. {maxPromoQty})</span>
            </div>
          )}
        </div>
      )}

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

      <div className="border-t border-white/20 pt-4">
        <p className="text-lg font-semibold">
          Total: ${total.toLocaleString('es-CL')} CLP
        </p>
      </div>
    </div>
  );
}
