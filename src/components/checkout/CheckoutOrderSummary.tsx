import React from 'react';
import type { CheckoutPriceBreakdown } from '@/services/checkoutService';
import type { CartItem } from '@/types';
import type { CartSplit } from '@/utils/localStock';
import { Package, Truck, Sparkles, CheckCircle2, Hourglass, AlertCircle, Handshake } from 'lucide-react';
import { convertYen as fxConvert } from '@/services/fxService';
import { baseYen, hasDiscount } from '@/utils/pricing';
import { productEnglishName } from '@/utils/productName';
import { formatPrice } from '@/utils/currency';
import CouponSelector from '@/components/checkout/CouponSelector';
import { POINTS } from '@/services/pointsService';
import { PS_FEE_PER_UNIT_YEN } from '../../../shared/money.js';
import { Coupon } from '@/context/UserContext';
import { Negotiation } from '@/types/negotiation';

interface CheckoutOrderSummaryProps {
  split: CartSplit;
  setShipChoiceOpen: (value: React.SetStateAction<boolean>) => void;
  localKind: "japan" | "local" | "mixed";
  mixedOrder: boolean;
  formData: { name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; };
  items: CartItem[];
  unitDisplayOf: (item: CartItem) => number;
  isLocalItem: (item: CartItem) => boolean;
  currency: "BRL" | "JPY" | "EUR" | "USD";
  appliedCoupon: Coupon;
  regularSubtotalForCoupon: number;
  couponDiscount: number;
  discountedItemCount: number;
  handleCouponApply: (coupon: Coupon) => void;
  handleCouponRemove: () => void;
  isAuthenticated: boolean;
  isGuest: boolean;
  canRedeem: boolean;
  availablePoints: number;
  maxRedeemable: number;
  pointsToUse: number;
  setPointsToUse: (value: React.SetStateAction<number>) => void;
  redeemPoints: number;
  shown: CheckoutPriceBreakdown & { nationalShipping: number };
  anyLocal: boolean;
  pointsDiscount: number;
  estimatedTax: number;
  taxLabel: string;
  localShippingValue: number;
  localOrder: boolean;
  selectedShipping: { carrier: string; cost: number; costYen: number; estimatedDays: string; };
  actualShippingCost: number;
  totalQty: number;
  effectivePsFeeDiscountYen: number;
  psFeeYen: number;
  psFeeOriginalDisplay: number;
  psFeeFinalYen: number;
  psFeeDisplay: number;
  psFeeQty: number;
  psFeeWaived: boolean;
  negIsApproved: boolean;
  activeNeg: Negotiation;
  negIsPending: boolean;
  negIsRejected: boolean;
  negActuallyExpired: boolean;
  pointsCoverAllProducts: boolean;
  setNegModalType: (value: React.SetStateAction<"shipping" | "ps_fee">) => void;
  maxAutoApprovable: number;
  shippingDiscountYen: number;
  shippingDiscountDisplay: number;
  totalSavings: number;
  grandTotal: number;
}

const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  split,
  setShipChoiceOpen,
  localKind,
  mixedOrder,
  formData,
  items,
  unitDisplayOf,
  isLocalItem,
  currency,
  appliedCoupon,
  regularSubtotalForCoupon,
  couponDiscount,
  discountedItemCount,
  handleCouponApply,
  handleCouponRemove,
  isAuthenticated,
  isGuest,
  canRedeem,
  availablePoints,
  maxRedeemable,
  pointsToUse,
  setPointsToUse,
  redeemPoints,
  shown,
  anyLocal,
  pointsDiscount,
  estimatedTax,
  taxLabel,
  localShippingValue,
  localOrder,
  selectedShipping,
  actualShippingCost,
  totalQty,
  effectivePsFeeDiscountYen,
  psFeeYen,
  psFeeOriginalDisplay,
  psFeeFinalYen,
  psFeeDisplay,
  psFeeQty,
  psFeeWaived,
  negIsApproved,
  activeNeg,
  negIsPending,
  negIsRejected,
  negActuallyExpired,
  pointsCoverAllProducts,
  setNegModalType,
  maxAutoApprovable,
  shippingDiscountYen,
  shippingDiscountDisplay,
  totalSavings,
  grandTotal,
}) => {
  return (
    <>
    {/* Order Summary Sidebar */}
    <div className="lg:col-span-1 min-w-0">
      <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 space-y-6 shadow-sm min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-sans text-lg font-bold text-foreground">
            Resumo do Pedido
          </h2>
        </div>

        {/* Há itens que já estão no país do cliente: ele pode trocar a forma de envio a qualquer momento */}
        {split.kind !== 'japan' && (
          <button
            type="button"
            onClick={() => setShipChoiceOpen(true)}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100"
          >
            <span>
              <span className="block text-sm font-bold text-emerald-900">Modificar forma de envio</span>
              <span className="block text-xs text-emerald-800">
                {localKind === 'japan' ? 'Agora: tudo junto do Japão' : mixedOrder ? 'Agora: enviar separado (um pedido, dois envios)' : `Agora: tudo enviado do ${formData.country}`}
              </span>
            </span>
            <Truck className="h-5 w-5 shrink-0 text-emerald-700" />
          </button>
        )}
        <div className="space-y-4">
          {items.map((item) => {
            const itemIsPromo = item.product.id.endsWith('_promo');
            const currentUnitPrice = item.freeGift ? 0 : unitDisplayOf(item);
            const originalUnitPrice = item.freeGift ? 0 : (isLocalItem(item) ? currentUnitPrice : fxConvert(baseYen(item.product, item.size), currency));
            const displayItemPrice = currentUnitPrice * item.quantity;
            const originalItemPrice = originalUnitPrice * item.quantity;
            const productName = productEnglishName(item.product);
            const hasProductDiscount = !isLocalItem(item) && hasDiscount(item.product);
            const affiliateEligible = Boolean(appliedCoupon?.affiliateCode)
              && !item.freeGift && !itemIsPromo && !hasProductDiscount;
            const itemCouponDiscount = affiliateEligible && regularSubtotalForCoupon > 0
              ? couponDiscount * (displayItemPrice / regularSubtotalForCoupon)
              : 0;
            const finalItemPrice = Math.max(0, displayItemPrice - itemCouponDiscount);
            return (
              <div
                key={`${item.product.id}-${item.size}`}
                className="flex items-center gap-3 py-2"
              >
                <img
                  src={item.product.image}
                  alt={productName}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-gray-800 truncate">{productName}</p>
                  {hasProductDiscount && (
                    <p className="text-[10px] text-muted-foreground line-through">{formatPrice(originalItemPrice, currency)}</p>
                  )}
                  {affiliateEligible && itemCouponDiscount > 0 && (
                    <p className="text-[10px] text-muted-foreground line-through">{formatPrice(displayItemPrice, currency)}</p>
                  )}
                  {(itemIsPromo || hasProductDiscount) && (
                    <p className="text-[10px] text-red-600 font-bold">
                      {hasProductDiscount ? `−${item.product.discountPercent}% desconto da loja` : 'Preço promocional da loja'}
                    </p>
                  )}
                  {affiliateEligible && itemCouponDiscount > 0 && (
                    <p className="text-[10px] text-green-600 font-bold">
                      −{appliedCoupon?.discount}% cupom de afiliado
                    </p>
                  )}
                  {mixedOrder && !item.freeGift && (
                    <p className={`text-[10px] font-bold ${isLocalItem(item) ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {isLocalItem(item) ? `📍 Enviado do ${formData.country}` : '✈️ Enviado do Japão'}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                    {item.freeGift ? '🎁 Presente da promoção' : (item.variantLabel || (item.size === 'small' ? 'Pequeno' : 'Grande'))} • {item.quantity}x
                  </p>
                </div>
                <p className={`font-bold text-xs ${item.freeGift ? 'text-green-600' : 'text-gray-800'}`}>
                  {item.freeGift ? 'GRÁTIS' : formatPrice(finalItemPrice, currency, isLocalItem(item))}
                </p>
              </div>
            );
          })}
          {discountedItemCount > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <p className="font-bold">🏷️ Produto(s) com desconto promocional</p>
              <p className="mt-0.5">
                {discountedItemCount} item(ns) já tem desconto da loja. O cupom de afiliado só será aplicado aos produtos fora da promoção; não há acúmulo de descontos.
              </p>
            </div>
          )}


          {/* Coupon Selector Widget */}
          <CouponSelector
            totalPrice={regularSubtotalForCoupon}
            currency={currency}
            onCouponApply={handleCouponApply}
            onCouponRemove={handleCouponRemove}
            appliedCoupon={appliedCoupon}
          />

          {/* Points Redemption */}
          {isAuthenticated && !isGuest && (
            <div className={`rounded-xl p-3 border text-xs ${canRedeem ? 'bg-purple-50 dark:bg-purple-950/20 border-dashed border-purple-300' : 'bg-muted/40 border-border'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${canRedeem ? 'text-purple-600' : 'text-muted-foreground'}`} />
                <span className={`font-bold ${canRedeem ? 'text-purple-800 dark:text-purple-300' : 'text-muted-foreground'}`}>
                  Pontos de fidelidade ({availablePoints} disponíveis)
                </span>
              </div>
              {!canRedeem ? (
                <p className="text-muted-foreground leading-snug">
                  Mínimo de <strong>{POINTS.minRedeem} pontos</strong> para resgatar. Faltam <strong>{POINTS.minRedeem - availablePoints}</strong> pontos.
                </p>
              ) : (
                <>
                  <p className="text-purple-700 mb-2 leading-snug">1 ponto = ¥1 de desconto. Máx. resgatável: {maxRedeemable} pts.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={maxRedeemable}
                      value={pointsToUse || ''}
                      onChange={e => setPointsToUse(Math.max(0, Math.min(maxRedeemable, Number(e.target.value) || 0)))}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 rounded-lg border border-purple-300 bg-background text-sm"
                    />
                    <button type="button" onClick={() => setPointsToUse(maxRedeemable)}
                      className="text-xs font-semibold text-purple-700 hover:underline">
                      Usar máx.
                    </button>
                    {redeemPoints > 0 && (
                      <button type="button" onClick={() => setPointsToUse(0)}
                        className="text-xs text-muted-foreground hover:underline ml-auto">
                        limpar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Calculations breakdown */}
          <div className="space-y-2 pt-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground min-w-0 truncate">Subtotal dos itens</span>
              <span className="font-semibold text-gray-800 shrink-0 whitespace-nowrap">{formatPrice(shown.subtotal, currency, anyLocal)}</span>
            </div>

            {appliedCoupon && couponDiscount > 0 && (
              <div className="flex justify-between text-green-600 font-bold bg-green-50/50 p-1.5 rounded border border-dashed border-green-200">
                <span>Desconto ({appliedCoupon.code})</span>
                <span>-{formatPrice(couponDiscount, currency)}</span>
              </div>
            )}

            {redeemPoints > 0 && (
              <div className="flex justify-between text-purple-700 font-bold bg-purple-50/60 p-1.5 rounded border border-dashed border-purple-200">
                <span>Pontos ({redeemPoints} pts)</span>
                <span>-{formatPrice(pointsDiscount, currency)}</span>
              </div>
            )}

            {/* Tax displays only as estimated warnings in sidebar */}
            {formData.country !== 'Japão' && estimatedTax > 0 && (
              <div className="bg-pink-50/50 dark:bg-pink-950/10 border border-pink-200/60 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex justify-between text-xs font-bold text-orange-850 dark:text-pink-300">
                  <span>{taxLabel}</span>
                  <span>{formatPrice(estimatedTax, currency)}</span>
                </div>
                <p className="text-[10px] text-pink-700 dark:text-pink-400 leading-relaxed font-semibold">
                  ⚠️ <strong>Lembrete:</strong> Este imposto é estimado e poderá ser cobrado pela alfândega na chegada ao país. Ele <strong>NÃO</strong> está incluído no total cobrado no site.
                </p>
              </div>
            )}

            {/* Frete do Japão (itens que vêm de lá) e frete nacional (itens do país do cliente): duas remessas */}
            {mixedOrder && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete nacional ({formData.country})</span>
                {localShippingValue !== null ? (
                  <span className="font-semibold text-gray-800">
                    {shown.nationalShipping === 0 ? 'Grátis' : formatPrice(shown.nationalShipping, currency, true)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">Escolha o frete</span>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {localOrder ? 'Frete nacional' : formData.country === 'Japão' ? 'Frete Local' : mixedOrder ? 'Frete Internacional (Japão)' : 'Frete Internacional'}
              </span>
              {selectedShipping ? (
                <span className="font-semibold text-gray-800">
                  {(actualShippingCost - shown.nationalShipping) === 0 ? 'Grátis' : formatPrice(actualShippingCost - shown.nationalShipping, currency, anyLocal)}
                </span>
              ) : (
                <span className="text-muted-foreground text-[10px]">
                  {formData.country === 'Japão' ? 'Aguardando Província' : 'Aguardando Estado'}
                </span>
              )}
            </div>

            {selectedShipping && (
              <div className="text-[10px] text-gray-400 text-right">
                {selectedShipping.carrier}{selectedShipping.estimatedDays ? ` • ${selectedShipping.estimatedDays} dias` : ''}
              </div>
            )}

            {/* Taxa Personal Shopper (e negociação de taxa/frete): não existe em pedido enviado do país do cliente */}
            {totalQty > 0 && !localOrder && (
              <div className="pt-2 border-t border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Taxa Personal Shopper</span>
                  <div className="text-right">
                    {effectivePsFeeDiscountYen > 0 ? (
                      <>
                        <span className="text-[10px] text-muted-foreground line-through mr-1">
                          {currency === 'JPY' ? `¥ ${psFeeYen.toLocaleString()}` : `${formatPrice(psFeeOriginalDisplay, currency, true)} (¥ ${psFeeYen.toLocaleString()})`}
                        </span>
                        <span className="font-semibold text-green-600">
                          {currency === 'JPY' ? `¥ ${psFeeFinalYen.toLocaleString()}` : `${formatPrice(psFeeDisplay, currency, true)} (¥ ${psFeeFinalYen.toLocaleString()})`}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold">
                        {currency === 'JPY' ? `¥ ${psFeeFinalYen.toLocaleString()}` : `${formatPrice(psFeeDisplay, currency, true)} (¥ ${psFeeFinalYen.toLocaleString()})`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{psFeeQty}x ¥{PS_FEE_PER_UNIT_YEN.toLocaleString()} • serviço de compra</span>
                  {psFeeWaived && (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Isenta — oferta
                    </span>
                  )}
                  {negIsApproved && activeNeg?.type === 'ps_fee' && (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Aprovado
                    </span>
                  )}
                  {negIsPending && activeNeg?.type === 'ps_fee' && (
                    <span className="text-[10px] text-pink-500 font-bold flex items-center gap-0.5">
                      <Hourglass className="w-3 h-3" /> Aguardando
                    </span>
                  )}
                  {negIsRejected && activeNeg?.type === 'ps_fee' && (
                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3" /> Recusado
                    </span>
                  )}
                  {negActuallyExpired && activeNeg?.type === 'ps_fee' && (
                    <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3" /> Expirado
                    </span>
                  )}
                </div>
                {/* A dona relatou que todo mundo passava batido pela taxa: o antigo link de
                    10px parecia rótulo, não convite. Agora é um alvo de toque cheio que
                    "respira" (pulse-zoom) até ser clicado. Texto "Pedir desconto" em vez de
                    "Negociar" porque nomeia o benefício, não o processo. */}
                {!psFeeWaived && !activeNeg && !pointsCoverAllProducts && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setNegModalType('ps_fee')}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-primary bg-pink-50 dark:bg-pink-950/20 text-sm font-bold text-pink-700 dark:text-pink-300 transition-colors hover:bg-pink-700 hover:text-white dark:hover:bg-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 animate-pulse-zoom hover:animate-none motion-reduce:animate-none"
                    >
                      <Handshake className="w-5 h-5 shrink-0" /> Pedir desconto nesta taxa
                    </button>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                      Esta taxa é negociável: até ¥{maxAutoApprovable.toLocaleString()} de desconto sai aprovado na hora.
                    </p>
                  </div>
                )}
                {pointsCoverAllProducts && (
                  <p className="text-xs text-muted-foreground mt-2 leading-snug">
                    Esta taxa não é negociável quando o pedido é pago integralmente com pontos.
                  </p>
                )}
                {psFeeWaived && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 leading-snug">
                    Isenção válida só para finalização imediata — se sair da página, a taxa volta a ser cobrada.
                  </p>
                )}
                {/* Negociar frete (aparece só depois de selecionar frete e sem negociação ativa) */}
                {selectedShipping && !activeNeg && (
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">Negociar frete</span>
                    <button
                      type="button"
                      onClick={() => setNegModalType('shipping')}
                      className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                    >
                      <Handshake className="w-3 h-3" /> Negociar
                    </button>
                  </div>
                )}
                {selectedShipping && shippingDiscountYen > 0 && (
                  <div className="flex items-center justify-between mt-1 text-[10px] text-green-600 font-bold">
                    <span>Desconto frete</span>
                    <span>-{formatPrice(shippingDiscountDisplay, currency)}</span>
                  </div>
                )}
              </div>
            )}

            {/* EUA: imposto pré-pago pela loja (DDP), dentro do total. */}
            {shown.importDuty > 0 && (
              <div className="pt-2 border-t border-border/60">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imposto de importação EUA (pré-pago)</span>
                  <span className="font-semibold text-gray-800">{formatPrice(shown.importDuty, currency)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Envio DDP: o imposto é pago pela loja antes da postagem. Nada é cobrado na entrega.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-border font-bold items-start">
              <span className="text-sm">Total a pagar</span>
              <div className="text-right">
                {totalSavings > 0 && (
                  <p className="text-xs text-muted-foreground line-through font-normal">
                    {formatPrice(grandTotal + totalSavings, currency, anyLocal)}
                  </p>
                )}
                <span className="text-base text-pink-600">
                  {formatPrice(grandTotal, currency, anyLocal)}
                </span>
                {totalSavings > 0 && (
                  <p className="text-[10px] text-green-600 font-bold mt-0.5">
                    Você economiza {formatPrice(totalSavings, currency, anyLocal)}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
};

export default CheckoutOrderSummary;
