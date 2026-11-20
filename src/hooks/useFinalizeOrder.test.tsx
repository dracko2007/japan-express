// Encerrar a compra depois do pagamento: o mesmo comportamento que a tela de revisão tinha, agora compartilhado.
import React from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthoritativeCheckoutOrder } from '@/services/checkoutService';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  removePurchasedItems: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  printOrder: vi.fn(),
  clearRecovery: vi.fn(),
  setShipAll: vi.fn(),
  clearWaiver: vi.fn(),
  store: new Map<string, string>(),
}));

vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router-dom')>()), useNavigate: () => mocks.navigate }));
vi.mock('@/context/CartContext', () => ({ useCart: () => ({ removePurchasedItems: mocks.removePurchasedItems }) }));
vi.mock('@/services/emailServiceSimple', () => ({ emailServiceSimple: { sendOrderConfirmation: mocks.sendOrderConfirmation } }));
vi.mock('@/services/thermalPrintService', () => ({ thermalPrintService: { printOrder: mocks.printOrder } }));
vi.mock('@/utils/recoveryCouponState', () => ({ recoveryCouponState: { clear: mocks.clearRecovery } }));
vi.mock('@/utils/localStock', () => ({ setShipAllFromJapan: mocks.setShipAll }));
vi.mock('@/utils/psFeeWaiver', () => ({ psFeeWaiver: { clear: mocks.clearWaiver } }));
vi.mock('@/utils/storage', () => ({
  safeStorage: {
    getItem: (key: string) => mocks.store.get(key) ?? null,
    setItem: (key: string, value: string) => { mocks.store.set(key, value); },
    removeItem: (key: string) => { mocks.store.delete(key); },
  },
}));

import { useFinalizeOrder } from './useFinalizeOrder';

const orderOf = (paymentMethod: string, orderNumber = 'SE-US-1') => ({ orderNumber, paymentMethod }) as unknown as AuthoritativeCheckoutOrder;
const setup = () => renderHook(() => useFinalizeOrder(), { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> }).result.current;

describe('useFinalizeOrder', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => { if (typeof value === 'function') (value as ReturnType<typeof vi.fn>).mockReset?.(); });
    mocks.store.clear();
    localStorage.clear();
  });

  it('cliente logado: guarda o pedido (sem duplicar), limpa carrinho e cupons e abre a confirmação', () => {
    mocks.store.set('sakura_orders', JSON.stringify([orderOf('card', 'SE-US-1'), orderOf('card', 'SE-US-0')]));
    mocks.store.set('sakura_pending_checkout', '{}');
    localStorage.setItem('activeNegId', 'n1');
    const finalize = setup();
    const order = orderOf('card', 'SE-US-1');
    finalize(order, false);

    const saved = JSON.parse(mocks.store.get('sakura_orders') as string) as AuthoritativeCheckoutOrder[];
    expect(saved.map((o) => o.orderNumber)).toEqual(['SE-US-1', 'SE-US-0']);
    expect(mocks.removePurchasedItems).toHaveBeenCalledTimes(1);
    expect(mocks.clearRecovery).toHaveBeenCalled();
    expect(mocks.setShipAll).toHaveBeenCalledWith(false);
    expect(mocks.clearWaiver).toHaveBeenCalled();
    expect(mocks.store.has('sakura_pending_checkout')).toBe(false);
    expect(localStorage.getItem('activeNegId')).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith('/order-confirmation', { state: { order, isGuest: false } });
  });

  it('convidado: não grava pedidos no aparelho', () => {
    setup()(orderOf('card'), true);
    expect(mocks.store.has('sakura_orders')).toBe(false);
    expect(mocks.navigate).toHaveBeenCalledWith('/order-confirmation', { state: { order: expect.anything(), isGuest: true } });
  });

  it('e-mail de confirmação só para quem não pagou por cartão (no cartão sai pelo webhook)', () => {
    setup()(orderOf('card'), false);
    expect(mocks.sendOrderConfirmation).not.toHaveBeenCalled();
    setup()(orderOf('wise', 'SE-US-2'), false);
    expect(mocks.sendOrderConfirmation).toHaveBeenCalledWith({ orderNumber: 'SE-US-2' });
  });
});
