import type { Order } from '@/types';
import { localCarrierLabel } from '../../../shared/local-stock.js';
import { formatPrice } from '@/utils/currency';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pedido que sai do estoque que já está no país do cliente (empresa parceira), não do Japão. */
export const isLocalOrder = (order: Order): boolean => order.fulfillment === 'local' && Boolean(order.shipFrom);
/** Um pedido, dois envios: os itens marcados `local` saem do país do cliente, os outros do Japão. */
export const isMixedOrder = (order: Order): boolean => order.fulfillment === 'mixed' && Boolean(order.shipFrom);
export const carrierText = (order: Order): string =>
  (isLocalOrder(order) ? localCarrierLabel(order.shipFrom) : order.shippingCarrier || '');
/** Frete nacional como foi cobrado, na moeda do pedido; null em pedido do Japão (frete em ¥). */
export const localShippingText = (order: Order): string | null => {
  if (!(isLocalOrder(order) || isMixedOrder(order)) || order.priceBreakdown?.shipping == null) return null;
  const amount = Number(order.priceBreakdown.shipping);
  return amount > 0 ? formatPrice(amount, order.currency || 'JPY', true) : 'Grátis';
};
