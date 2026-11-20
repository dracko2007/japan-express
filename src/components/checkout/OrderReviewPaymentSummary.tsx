import React from 'react';
import type { CheckoutPriceBreakdown } from '@/services/checkoutService';
import type { CartItem } from '@/types';
import type { UserProfile } from '@/context/UserContext';
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import { Button } from '@/components/ui/button';

interface OrderReviewPaymentSummaryProps {
  items: CartItem[];
  view: CheckoutPriceBreakdown;
  currency: "BRL" | "JPY" | "EUR" | "USD";
  localOrder: boolean;
  couponDiscount: number;
  appliedCoupon: { code: string; freeShipping?: boolean; discount?: number; discountType?: string; affiliateCode?: string; minOrderValue?: number; };
  pointsDiscount: number;
  redeemPoints: number;
  finalShippingCost: number;
  psFeeGrossYen: number;
  effectivePsFeeDiscountYen: number;
  psFeeFinalYen: number;
  psFeeDisplay: number;
  estimatedTax: number;
  taxLabel: string;
  isPix: boolean;
  grandTotal: number;
  pixIofFee: number;
  pixBankFee: number;
  finalGrandTotal: number;
  paymentMethod: string;
  grandTotalYen: number | undefined;
  quoteErrorMessage: string;
  handleProceedToPayment: () => Promise<void>;
  orderCreating: boolean;
  quoteLoading: boolean;
  user: UserProfile;
  earnedPoints: number;
  pointsMultiplier: number;
}

const OrderReviewPaymentSummary: React.FC<OrderReviewPaymentSummaryProps> = ({
  items,
  view,
  currency,
  localOrder,
  couponDiscount,
  appliedCoupon,
  pointsDiscount,
  redeemPoints,
  finalShippingCost,
  psFeeGrossYen,
  effectivePsFeeDiscountYen,
  psFeeFinalYen,
  psFeeDisplay,
  estimatedTax,
  taxLabel,
  isPix,
  grandTotal,
  pixIofFee,
  pixBankFee,
  finalGrandTotal,
  paymentMethod,
  grandTotalYen,
  quoteErrorMessage,
  handleProceedToPayment,
  orderCreating,
  quoteLoading,
  user,
  earnedPoints,
  pointsMultiplier,
}) => {
  return (
    <>
    {/* Resumo de pagamento */}
    <div className="bg-card rounded-2xl border-2 border-primary/20 shadow-lg p-5">
      <h3 className="font-bold text-base text-foreground mb-4 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-primary" />
        Resumo do Pedido
      </h3>

      <div className="space-y-2 text-sm">
        {/* Itens */}
        <div className="flex justify-between text-muted-foreground">
          <span>Itens ({items.filter(i => !i.freeGift).length}x)</span>
          <span>{formatPrice(view.subtotal, currency, localOrder)}</span>
        </div>

        {couponDiscount > 0 && (
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Cupom ({appliedCoupon?.code})</span>
            <span>−{formatPrice(couponDiscount, currency, localOrder)}</span>
          </div>
        )}

        {pointsDiscount > 0 && (
          <div className="flex justify-between text-purple-600 font-semibold">
            <span>Pontos ({redeemPoints} pts)</span>
            <span>−{formatPrice(pointsDiscount, currency, localOrder)}</span>
          </div>
        )}

        <div className="flex justify-between text-muted-foreground">
          <span>Frete</span>
          <span>{finalShippingCost === 0 ? 'Grátis' : formatPrice(finalShippingCost, currency, localOrder)}</span>
        </div>

        {psFeeGrossYen > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa PS</span>
            <span className={effectivePsFeeDiscountYen > 0 ? 'text-green-600 font-semibold' : ''}>
              {currency === 'JPY' ? `¥ ${psFeeFinalYen.toLocaleString()}` : formatPrice(psFeeDisplay, currency, true)}
            </span>
          </div>
        )}

        {view.importDuty > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Imposto EUA (pré-pago)</span>
            <span>{formatPrice(view.importDuty, currency, localOrder)}</span>
          </div>
        )}

        {estimatedTax > 0 && (
          <p className="text-[10px] text-pink-600 bg-pink-50 rounded px-2 py-1 leading-snug">
            ⚠️ {taxLabel} ~{formatPrice(estimatedTax, currency, localOrder)} (cobrado pela alfândega, NÃO incluso)
          </p>
        )}
      </div>

      <div className="border-t border-border mt-4 pt-4">
        {/* PIX block */}
        {isPix && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-3 space-y-1.5">
            <p className="text-[10px] font-bold text-pink-700 uppercase tracking-wide">Pagamento via PIX</p>
            <div className="flex justify-between text-xs text-pink-700">
              <span>Subtotal</span>
              <span>{formatPrice(grandTotal, currency, localOrder)}</span>
            </div>
            <div className="flex justify-between text-xs text-pink-700">
              <span>+ IOF (3,5%)</span>
              <span>+ {formatPrice(pixIofFee, currency, localOrder)}</span>
            </div>
            <div className="flex justify-between text-xs text-pink-700">
              <span>+ Taxa bancária</span>
              <span>+ {formatPrice(pixBankFee, currency, localOrder)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-orange-900 border-t border-pink-200 pt-1 mt-1">
              <span>Total PIX</span>
              <span className="text-base">{formatPrice(finalGrandTotal, currency, localOrder)}</span>
            </div>
            <p className="text-[10px] text-amber-600 mt-1">⏱ Remessa em até 3 dias úteis após confirmação</p>
          </div>
        )}

        {/* Wise block */}
        {paymentMethod === 'wise' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 space-y-1.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Pagamento via Wise</p>
            <div className="flex justify-between text-xs text-emerald-700">
              <span>Total</span>
              <span className="font-bold">{formatPrice(grandTotal, currency, localOrder)}</span>
            </div>
            <div className="bg-emerald-100 rounded-lg p-2 text-center mt-1">
              <p className="text-[10px] text-emerald-700 mb-0.5">No campo <strong>Valor</strong> do Wise, insira:</p>
              <p className="text-xl font-black text-emerald-900">¥ {grandTotalYen.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600">A Wise converte automaticamente</p>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Taxa Wise ~4% • Sem IOF</p>
          </div>
        )}

        {/* Total sem método específico */}
        {!isPix && paymentMethod !== 'wise' && (
          <div className="flex justify-between font-black text-xl mb-3">
            <span>Total</span>
            <span className="text-pink-600">{formatPrice(finalGrandTotal, currency, localOrder)}</span>
          </div>
        )}

        {/* Total geral (sempre visível abaixo dos blocos PIX/Wise) */}
        {(isPix || paymentMethod === 'wise') && (
          <div className="flex justify-between font-black text-base text-muted-foreground mb-3">
            <span>Total Geral</span>
            <span className="text-pink-600 text-xl">{formatPrice(finalGrandTotal, currency, localOrder)}</span>
          </div>
        )}

        {quoteErrorMessage && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mb-3 leading-snug">
            {quoteErrorMessage}
          </p>
        )}

        {/* Espera a conta do servidor: o clique cobra o número que está na tela. */}
        <Button
          onClick={handleProceedToPayment}
          disabled={orderCreating || quoteLoading}
          className="w-full btn-primary rounded-xl py-5 text-base font-bold"
        >
          <CheckCircle className="w-5 h-5 mr-2" />
          {orderCreating ? 'Criando pedido seguro...' : quoteLoading ? 'Atualizando valores...' : 'Confirmar e Pagar'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        {user && earnedPoints > 0 && (
          <div className="flex justify-center gap-1 text-green-700 text-xs mt-3 bg-green-50 rounded-lg py-2">
            <Sparkles className="w-3.5 h-3.5 mt-0.5" />
            <span>+{earnedPoints} pontos após a compra{pointsMultiplier > 1 && <span className="ml-1 inline-block bg-green-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">x{pointsMultiplier}</span>}</span>
          </div>
        )}
      </div>
    </div>

    </>
  );
};

export default OrderReviewPaymentSummary;
