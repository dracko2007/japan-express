import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeStorage } from '@/utils/storage';
import { recoveryCouponState } from '@/utils/recoveryCouponState';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { thermalPrintService } from '@/services/thermalPrintService';
import { setShipAllFromJapan } from '@/utils/localStock';
import { psFeeWaiver } from '@/utils/psFeeWaiver';
import { pendingCheckout } from '@/utils/pendingCheckout';
import { useCart } from '@/context/CartContext';
import type { AuthoritativeCheckoutOrder } from '@/services/checkoutService';

/**
 * Encerra a compra depois que o pagamento foi aceito: guarda o pedido no aparelho, limpa carrinho e cupons e abre a
 * confirmação. O servidor já persistiu o pedido; estoque, cupons, pontos e promoções aguardam o pagamento confirmado
 * (webhook). Usado pelo pagamento que termina na própria tela e pelo que volta de outro site.
 */
export function useFinalizeOrder() {
  const navigate = useNavigate();
  const { removePurchasedItems } = useCart();

  return useCallback((order: AuthoritativeCheckoutOrder, isGuest: boolean) => {
    if (!isGuest) {
      const existingOrders = JSON.parse(safeStorage.getItem('sakura_orders') || '[]') as AuthoritativeCheckoutOrder[];
      const deduped = existingOrders.filter((item) => item.orderNumber !== order.orderNumber);
      safeStorage.setItem('sakura_orders', JSON.stringify([order, ...deduped]));
    }
    if (order.paymentMethod !== 'card') {
      void emailServiceSimple.sendOrderConfirmation({ orderNumber: order.orderNumber });
    }
    void thermalPrintService.printOrder(order);

    removePurchasedItems(); // só o que foi comprado: o que ficou desmarcado continua no carrinho
    recoveryCouponState.clear(); // cupom de recuperação é de um pedido só: já foi usado
    setShipAllFromJapan(false); // a escolha "tudo do Japão" vale só para o pedido que acabou de ser feito
    safeStorage.removeItem('redeem_points');
    safeStorage.removeItem('promo_applied');
    safeStorage.removeItem('pending_promo');
    safeStorage.removeItem('pending_promo_gift');
    safeStorage.removeItem('pending_promo_points');
    safeStorage.removeItem('promo_full_price');
    localStorage.removeItem('activeNegId');
    psFeeWaiver.clear();
    pendingCheckout.clear();

    navigate('/order-confirmation', { state: { order, isGuest } });
  }, [navigate, removePurchasedItems]);
}
