// Volta de um pagamento feito em outro site (Klarna, MB WAY, Scalapay): o Stripe devolve o cliente com o client secret na URL.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthoritativeCheckoutOrder } from '@/services/checkoutService';

const mocks = vi.hoisted(() => ({
  retrievePaymentIntent: vi.fn(),
  finalize: vi.fn(),
  store: new Map<string, string>(),
}));

vi.mock('@/lib/stripeClient', () => ({ stripePromise: Promise.resolve({ retrievePaymentIntent: mocks.retrievePaymentIntent }) }));
vi.mock('@/hooks/useFinalizeOrder', () => ({ useFinalizeOrder: () => mocks.finalize }));
vi.mock('@/components/layout/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/utils/storage', () => ({
  safeStorage: {
    getItem: (key: string) => mocks.store.get(key) ?? null,
    setItem: (key: string, value: string) => { mocks.store.set(key, value); },
    removeItem: (key: string) => { mocks.store.delete(key); },
  },
}));

import PaymentReturn from './PaymentReturn';
import { pendingCheckout } from '@/utils/pendingCheckout';

const order = { orderNumber: 'SE-US-123456', paymentMethod: 'card' } as unknown as AuthoritativeCheckoutOrder;
const renderAt = (url: string) => render(<MemoryRouter initialEntries={[url]}><PaymentReturn /></MemoryRouter>);
const URL_OK = '/pagamento/retorno?pedido=SE-US-123456&payment_intent_client_secret=pi_1_secret_2&redirect_status=succeeded';

describe('PaymentReturn', () => {
  beforeEach(() => {
    mocks.store.clear();
    mocks.retrievePaymentIntent.mockReset();
    mocks.finalize.mockReset();
  });

  it('pagamento aprovado com o pedido guardado: encerra a compra uma vez', async () => {
    pendingCheckout.save(order, false);
    mocks.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    renderAt(URL_OK);
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledTimes(1));
    expect(mocks.finalize).toHaveBeenCalledWith(order, false);
    expect(mocks.retrievePaymentIntent).toHaveBeenCalledWith('pi_1_secret_2');
  });

  it('"processing" também encerra (a confirmação final vem pelo webhook, como no cartão)', async () => {
    pendingCheckout.save(order, true);
    mocks.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'processing' } });
    renderAt(URL_OK);
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalledWith(order, true));
  });

  it('aprovado, mas sem o rascunho no aparelho (outra aba): mostra "Pagamento recebido" e não encerra nada', async () => {
    mocks.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    renderAt(URL_OK);
    expect(await screen.findByRole('heading', { name: 'Pagamento recebido' })).toBeInTheDocument();
    expect(screen.getByText(/Pedido SE-US-123456/)).toBeInTheDocument();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('rascunho de OUTRO pedido não é usado', async () => {
    pendingCheckout.save({ ...order, orderNumber: 'SE-US-999999' } as AuthoritativeCheckoutOrder, false);
    mocks.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    renderAt(URL_OK);
    expect(await screen.findByRole('heading', { name: 'Pagamento recebido' })).toBeInTheDocument();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('pagamento não concluído: avisa e não encerra a compra', async () => {
    pendingCheckout.save(order, false);
    mocks.retrievePaymentIntent.mockResolvedValue({ paymentIntent: { status: 'requires_payment_method' } });
    renderAt(URL_OK.replace('succeeded', 'failed'));
    expect(await screen.findByRole('heading', { name: 'O pagamento não foi concluído' })).toBeInTheDocument();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('sem client secret na URL, ou erro do Stripe: não conclui nada', async () => {
    renderAt('/pagamento/retorno');
    expect(await screen.findByRole('heading', { name: 'O pagamento não foi concluído' })).toBeInTheDocument();
    expect(mocks.retrievePaymentIntent).not.toHaveBeenCalled();

    mocks.retrievePaymentIntent.mockResolvedValue({ error: { message: 'x' } });
    renderAt(URL_OK);
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'O pagamento não foi concluído' })).toHaveLength(2));
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
});
