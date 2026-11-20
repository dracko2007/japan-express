/** Página para onde o Stripe devolve o cliente depois de um pagamento feito em outro site (Klarna, MB WAY, Scalapay...). */
export const PAYMENT_RETURN_PATH = '/pagamento/retorno';

export function paymentReturnUrl(orderId?: string): string {
  const query = orderId ? `?pedido=${encodeURIComponent(orderId)}` : '';
  return `${window.location.origin}${PAYMENT_RETURN_PATH}${query}`;
}
