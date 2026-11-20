import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthoritativeCheckoutOrder } from '@/services/checkoutService';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@/utils/storage', () => ({
  safeStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  },
}));

import { pendingCheckout } from './pendingCheckout';

const order = { orderNumber: 'SE-US-1' } as unknown as AuthoritativeCheckoutOrder;

describe('pendingCheckout', () => {
  beforeEach(() => store.clear());

  it('guarda e devolve o pedido (e se era convidado)', () => {
    pendingCheckout.save(order, true, 1000);
    expect(pendingCheckout.read(null, 2000)).toMatchObject({ order, isGuest: true });
  });

  it('só devolve se for o pedido pedido', () => {
    pendingCheckout.save(order, false, 1000);
    expect(pendingCheckout.read('SE-US-1', 2000)?.order.orderNumber).toBe('SE-US-1');
    expect(pendingCheckout.read('SE-US-2', 2000)).toBeNull();
  });

  it('vence depois de 2 horas', () => {
    pendingCheckout.save(order, false, 0);
    expect(pendingCheckout.read(null, 2 * 60 * 60 * 1000)).not.toBeNull();
    expect(pendingCheckout.read(null, 2 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it('dado corrompido ou ausente vira null, e limpar apaga', () => {
    expect(pendingCheckout.read()).toBeNull();
    store.set('sakura_pending_checkout', '{não é json');
    expect(pendingCheckout.read()).toBeNull();
    pendingCheckout.save(order, false);
    pendingCheckout.clear();
    expect(pendingCheckout.read()).toBeNull();
  });
});
