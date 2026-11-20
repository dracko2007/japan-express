import { safeStorage } from '@/utils/storage';
import type { AuthoritativeCheckoutOrder } from '@/services/checkoutService';

// Pagamento que sai do site (Klarna, MB WAY, Scalapay...) e volta pelo endereço de retorno perde o estado da tela.
// O pedido já está no servidor; aqui guardamos só o que a tela precisa para encerrar a compra quando o cliente voltar.
// A chave NÃO está na lista de permissão de `localData`: sai no logout, como todo dado de usuário.
const KEY = 'sakura_pending_checkout';
const TTL_MS = 2 * 60 * 60 * 1000;

export interface PendingCheckout {
  order: AuthoritativeCheckoutOrder;
  isGuest: boolean;
  savedAt: number;
}

export const pendingCheckout = {
  save(order: AuthoritativeCheckoutOrder, isGuest: boolean, now = Date.now()): void {
    safeStorage.setItem(KEY, JSON.stringify({ order, isGuest, savedAt: now } satisfies PendingCheckout));
  },

  /** O pedido guardado, ou null se não há, está vencido ou não é o `orderNumber` pedido. */
  read(orderNumber?: string | null, now = Date.now()): PendingCheckout | null {
    try {
      const raw = safeStorage.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<PendingCheckout>;
      if (!value?.order?.orderNumber || typeof value.savedAt !== 'number') return null;
      if (now - value.savedAt > TTL_MS) return null;
      if (orderNumber && value.order.orderNumber !== orderNumber) return null;
      return { order: value.order, isGuest: value.isGuest === true, savedAt: value.savedAt };
    } catch {
      return null;
    }
  },

  clear(): void {
    safeStorage.removeItem(KEY);
  },
};
