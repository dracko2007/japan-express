import type { Coupon } from '@/context/UserContext';
import { getMoneyRates } from '@/services/fxService';
import { couponTerms, discountYenToDisplay } from '../../shared/money.js';

/**
 * Prévia do desconto de um cupom do perfil, na moeda do cliente. Mesma regra
 * do servidor (`shared/money.js`): cupom fixo é em IENES — antes o valor em ¥
 * era descontado como se fosse R$/€/$ (cupom de ¥500 virava R$ 500).
 * O valor que vale é o do resumo do checkout, que usa `displayTotals`.
 */
export const computeCouponDiscount = (coupon: Coupon, subtotal: number, currency = 'JPY'): number => {
  const terms = couponTerms(coupon);
  if (!terms || terms.freeShipping || !(subtotal > 0)) return 0;
  if (terms.fixed) return Math.min(subtotal, discountYenToDisplay(terms.fixedYen, currency, getMoneyRates()));
  return Math.min(subtotal, Math.round(subtotal * terms.percent / 100));
};
