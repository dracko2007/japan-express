import React from 'react';
import type { CheckoutPriceBreakdown } from '@/services/checkoutService';
import type { ReviewFormData, ReviewShipping } from '@/components/checkout/reviewTypes';
import type { CartItem } from '@/types';
import type { UserProfile } from '@/context/UserContext';
import { Package, Tag, Sparkles, AlertCircle } from 'lucide-react';
import { productEnglishName } from '@/utils/productName';
import { formatPrice } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { convertYen as fxConvert } from '@/services/fxService';

interface OrderReviewItemsSummaryProps {
  isJapan: boolean;
  items: CartItem[];
  unitPriceFor: (item: CartItem) => number;
  mixedOrder: boolean;
  localItemSet: Set<CartItem>;
  country: string;
  currency: "BRL" | "JPY" | "EUR" | "USD";
  localOrder: boolean;
  view: CheckoutPriceBreakdown;
  appliedCoupon: { code: string; freeShipping?: boolean; discount?: number; discountType?: string; affiliateCode?: string; minOrderValue?: number; };
  couponInput: string;
  setCouponInput: (value: React.SetStateAction<string>) => void;
  setCouponError: (value: React.SetStateAction<string>) => void;
  handleApplyCoupon: () => Promise<void>;
  couponLoading: boolean;
  couponError: string;
  couponDiscount: number;
  setAppliedCoupon: (value: React.SetStateAction<{ code: string; freeShipping?: boolean; discount?: number; discountType?: string; affiliateCode?: string; minOrderValue?: number; }>) => void;
  user: UserProfile;
  availablePoints: number;
  pointsCoverAllProducts: boolean;
  psFeeDiscountYen: number;
  maxRedeemable: number;
  pointsToUse: number;
  setPointsToUse: (value: React.SetStateAction<number>) => void;
  redeemPoints: number;
  pointsDiscount: number;
  earnedPoints: number;
  pointsMultiplier: number;
  formData: ReviewFormData;
  estimatedTax: number;
  taxLabel: string;
  nationalShipping: number;
  pureLocalOrder: boolean;
  shipping: ReviewShipping;
  japanShippingCost: number;
  psFeeGrossYen: number;
  effectivePsFeeDiscountYen: number;
  psFeeFinalYen: number;
  psFeeDisplay: number;
  isPix: boolean;
  grandTotal: number;
  pixIofFee: number;
  pixBankFee: number;
  finalGrandTotal: number;
  quoteErrorMessage: string;
}

const OrderReviewItemsSummary: React.FC<OrderReviewItemsSummaryProps> = ({
  isJapan,
  items,
  unitPriceFor,
  mixedOrder,
  localItemSet,
  country,
  currency,
  localOrder,
  view,
  appliedCoupon,
  couponInput,
  setCouponInput,
  setCouponError,
  handleApplyCoupon,
  couponLoading,
  couponError,
  couponDiscount,
  setAppliedCoupon,
  user,
  availablePoints,
  pointsCoverAllProducts,
  psFeeDiscountYen,
  maxRedeemable,
  pointsToUse,
  setPointsToUse,
  redeemPoints,
  pointsDiscount,
  earnedPoints,
  pointsMultiplier,
  formData,
  estimatedTax,
  taxLabel,
  nationalShipping,
  pureLocalOrder,
  shipping,
  japanShippingCost,
  psFeeGrossYen,
  effectivePsFeeDiscountYen,
  psFeeFinalYen,
  psFeeDisplay,
  isPix,
  grandTotal,
  pixIofFee,
  pixBankFee,
  finalGrandTotal,
  quoteErrorMessage,
}) => {
  return (
    <>
    {/* Order Items Summary */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-sans text-xl font-bold text-foreground">
          {isJapan ? 'Produtos Selecionados (Entrega no Japão)' : 'Produtos Selecionados (Centro de Hiroshima)'}
        </h2>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const displayUnitPrice = unitPriceFor(item);
          const displayItemPrice = displayUnitPrice * item.quantity;
          const productName = productEnglishName(item.product);
          return (
            <div
              key={`${item.product.id}-${item.size}${item.freeGift ? '-gift' : ''}`}
              className={`flex items-center gap-4 pb-4 border-b border-border last:border-0${item.freeGift ? ' bg-purple-50 dark:bg-purple-950/20 rounded-lg px-2 pt-2' : ''}`}
            >
              <img
                src={item.product.image}
                alt={productName}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{productName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opção: {item.freeGift ? '🎁 Presente da promoção' : (item.variantLabel || (item.size === 'small' ? 'Pequeno' : 'Grande'))} • Quantidade: {item.quantity}x
                </p>
                {mixedOrder && !item.freeGift && (
                  <p className={`text-xs font-bold ${localItemSet.has(item) ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {localItemSet.has(item) ? `📍 Enviado do ${country}` : '✈️ Enviado do Japão'}
                  </p>
                )}
                {!item.freeGift && (
                  <p className="text-xs text-gray-400">
                    Preço unitário: {formatPrice(displayUnitPrice, currency, localOrder)}
                  </p>
                )}
              </div>
              <div className="text-right">
                {item.freeGift ? (
                  <p className="font-bold text-base text-green-600">GRÁTIS 🎁</p>
                ) : (
                  <p className="font-bold text-base text-foreground">
                    {formatPrice(displayItemPrice, currency, localOrder)}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Calculation breakdown */}
        <div className="pt-4 space-y-2.5 text-sm border-t border-border">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice(view.subtotal, currency, localOrder)}</span>
          </div>

          {/* Coupon input */}
          {!appliedCoupon && (
            <div className="bg-muted/40 border border-dashed border-border rounded-lg p-3 print:hidden">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Tem um cupom?</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                  placeholder="CÓDIGO DO CUPOM"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-mono uppercase"
                />
                <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                  {couponLoading ? '...' : 'Aplicar'}
                </Button>
              </div>
              {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
            </div>
          )}

          {couponDiscount > 0 && (
            <div className="flex justify-between text-green-600 font-bold bg-green-50/50 p-2 rounded border border-dashed border-green-200">
              <span className="flex items-center gap-2">
                Desconto do Cupom {appliedCoupon ? `(${appliedCoupon.code})` : ''}
                <button type="button" onClick={() => setAppliedCoupon(null)} className="text-[10px] text-red-400 hover:text-red-600 underline font-normal print:hidden">remover</button>
              </span>
              <span>-{formatPrice(couponDiscount, currency, localOrder)}</span>
            </div>
          )}

          {/* Resgate de pontos de fidelidade */}
          {user && availablePoints > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-dashed border-purple-300 rounded-lg p-3 print:hidden">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Usar pontos ({availablePoints} disponíveis)
                </span>
                <span className="text-[11px] text-purple-700">1 ponto = ¥1</span>
              </div>
              <>
                {pointsCoverAllProducts && psFeeDiscountYen > 0 && (
                  <p className="text-xs text-orange-700 dark:text-orange-400 leading-snug mb-2">
                    Como os pontos cobrem todos os produtos, o desconto ou a isenção da taxa do
                    Personal Shopper será desconsiderado — a taxa será cobrada integralmente.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={maxRedeemable}
                    value={pointsToUse || ''}
                    onChange={(e) => setPointsToUse(Math.max(0, Math.min(maxRedeemable, Number(e.target.value) || 0)))}
                    placeholder="0"
                    className="w-24 px-2 py-1.5 rounded-lg border border-purple-300 bg-background text-sm"
                  />
                  <button type="button" onClick={() => setPointsToUse(maxRedeemable)}
                    className="text-xs font-semibold text-purple-700 hover:underline">Usar máx. ({maxRedeemable})</button>
                  {redeemPoints > 0 && (
                    <button type="button" onClick={() => setPointsToUse(0)}
                      className="text-xs text-muted-foreground hover:underline ml-auto">limpar</button>
                  )}
                </div>
                <p className="text-[11px] text-purple-700 mt-1.5">
                  Vale só para os produtos — frete e taxa do Personal Shopper não podem ser pagos com pontos.
                </p>
              </>
            </div>
          )}

          {pointsDiscount > 0 && (
            <div className="flex justify-between text-purple-700 font-bold bg-purple-50/60 p-2 rounded border border-dashed border-purple-200">
              <span>Desconto em pontos ({redeemPoints} pts)</span>
              <span>-{formatPrice(pointsDiscount, currency, localOrder)}</span>
            </div>
          )}

          {user && earnedPoints > 0 && (
            <div className="flex justify-between text-green-700 text-xs bg-green-50/60 p-2 rounded">
              <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Você ganhará nesta compra</span>
              <span className="font-bold">+{earnedPoints} pts{pointsMultiplier > 1 && <span className="ml-1 inline-block bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">x{pointsMultiplier}</span>}</span>
            </div>
          )}

          {/* Estimated international taxes (shown only as reminder, not summed) */}
          {formData.country !== 'Japão' && estimatedTax > 0 && (
            <div className="bg-pink-50/50 dark:bg-pink-950/10 border border-pink-200/60 rounded-xl p-3 space-y-2 mt-2">
              <div className="flex justify-between text-xs font-bold text-orange-850 dark:text-pink-300">
                <span>{taxLabel}</span>
                <span>{formatPrice(estimatedTax, currency, localOrder)}</span>
              </div>
              <p className="text-[10px] text-pink-700 dark:text-pink-400 leading-relaxed font-semibold">
                ⚠️ <strong>Nota:</strong> Este imposto é aproximado e poderá ser cobrado pela alfândega local na chegada do pacote no país de destino. Ele <strong>NÃO</strong> foi adicionado ao total geral cobrado no site.
              </p>
            </div>
          )}

          {mixedOrder && (
            <div className="flex justify-between text-muted-foreground">
              <span>Frete nacional ({formData.country})</span>
              <span>{nationalShipping === 0 ? 'Grátis' : formatPrice(nationalShipping, currency, true)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>{pureLocalOrder ? 'Frete nacional' : isJapan ? 'Frete Local' : 'Frete Aéreo'} ({shipping.carrier})</span>
            <span>{japanShippingCost === 0 ? 'Grátis' : formatPrice(japanShippingCost, currency, localOrder)}</span>
          </div>

          {!pureLocalOrder && <div className="text-[10px] text-gray-400 text-right">
            {isJapan ? 'Envio doméstico seguro de Hiroshima Prefecture.' : `Envio internacional de Hiroshima para ${formData.country}.`} Entrega estimada: {shipping.estimatedDays} dias úteis
          </div>}

          {psFeeGrossYen > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa Personal Shopper</span>
              <div className="text-right">
                {effectivePsFeeDiscountYen > 0 && (
                  <span className="text-xs line-through text-muted-foreground mr-1">
                    {currency === 'JPY' ? `¥ ${psFeeGrossYen.toLocaleString()}` : `${formatPrice(fxConvert(psFeeGrossYen, currency, true), currency, true)} (¥ ${psFeeGrossYen.toLocaleString()})`}
                  </span>
                )}
                <span className={effectivePsFeeDiscountYen > 0 ? 'text-green-600 font-semibold' : ''}>
                  {currency === 'JPY' ? `¥ ${psFeeFinalYen.toLocaleString()}` : `${formatPrice(psFeeDisplay, currency, true)} (¥ ${psFeeFinalYen.toLocaleString()})`}
                </span>
              </div>
            </div>
          )}

          {/* EUA: imposto pré-pago pela loja (DDP), dentro do total. */}
          {view.importDuty > 0 && (
            <div>
              <div className="flex justify-between text-muted-foreground">
                <span>Imposto de importação EUA (pré-pago, DDP)</span>
                <span>{formatPrice(view.importDuty, currency, localOrder)}</span>
              </div>
              <p className="text-[10px] text-gray-400 text-right">
                A loja paga o imposto antes de postar. Nada é cobrado na entrega.
              </p>
            </div>
          )}

          {isPix && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-1.5 mt-1">
              <p className="text-[10px] text-pink-600 font-semibold mb-1">
                Taxas aplicadas por pagamento via PIX (remessa internacional)
              </p>
              <div className="flex justify-between text-xs text-gray-500 border-b border-pink-100 pb-1.5">
                <span>Subtotal (antes das taxas PIX)</span>
                <span>{formatPrice(grandTotal, currency, localOrder)}</span>
              </div>
              <div className="flex justify-between text-xs text-pink-700">
                <span>+ IOF (3,5% sobre o subtotal)</span>
                <span>+ {formatPrice(pixIofFee, currency, localOrder)}</span>
              </div>
              <div className="flex justify-between text-xs text-pink-700">
                <span>+ Taxa bancária de remessa (fixa)</span>
                <span>+ {formatPrice(pixBankFee, currency, localOrder)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-orange-900 bg-pink-100 rounded px-1.5 py-1 mt-0.5">
                <span>= Total com taxas PIX</span>
                <span>{formatPrice(finalGrandTotal, currency, localOrder)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-3 border-t border-border font-black text-lg">
            <span>Total Geral</span>
            <span className="text-2xl text-pink-600">
              {formatPrice(finalGrandTotal, currency, localOrder)}
            </span>
          </div>
          {quoteErrorMessage && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 print:hidden">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              {quoteErrorMessage}
            </p>
          )}
        </div>
      </div>
    </div>

    </>
  );
};

export default OrderReviewItemsSummary;
