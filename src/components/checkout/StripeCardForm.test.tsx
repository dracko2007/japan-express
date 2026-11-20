// O pagamento termina na própria tela (cartão, carteiras) ou sai do site e volta pelo return_url (Klarna, MB WAY, Scalapay).
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ confirmPayment: vi.fn() }));

vi.mock('@/lib/stripeClient', () => ({ stripePromise: Promise.resolve({}) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div>campos do pagamento</div>,
  useStripe: () => ({ confirmPayment: mocks.confirmPayment }),
  useElements: () => ({}),
}));

import StripeCardForm from './StripeCardForm';

const pay = () => fireEvent.click(screen.getByRole('button', { name: /Pagar com Cartão/ }));

describe('StripeCardForm', () => {
  const onSuccess = vi.fn();
  beforeEach(() => { mocks.confirmPayment.mockReset(); onSuccess.mockReset(); });

  it('confirma com return_url (para métodos que redirecionam) e continua sem redirecionar quando não precisa', async () => {
    mocks.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    render(<StripeCardForm clientSecret="pi_1_secret_2" orderId="SE-US-123456" onSuccess={onSuccess} />);
    pay();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const args = mocks.confirmPayment.mock.calls[0][0];
    expect(args.redirect).toBe('if_required');
    expect(args.confirmParams.return_url).toBe(`${window.location.origin}/pagamento/retorno?pedido=SE-US-123456`);
  });

  it('sem número do pedido, o return_url vai sem o parâmetro', async () => {
    mocks.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });
    render(<StripeCardForm clientSecret="pi_1_secret_2" onSuccess={onSuccess} />);
    pay();
    await waitFor(() => expect(mocks.confirmPayment).toHaveBeenCalled());
    expect(mocks.confirmPayment.mock.calls[0][0].confirmParams.return_url).toBe(`${window.location.origin}/pagamento/retorno`);
  });

  it('erro do Stripe: mostra a mensagem e não encerra a compra', async () => {
    mocks.confirmPayment.mockResolvedValue({ error: { message: 'Cartão recusado.' } });
    render(<StripeCardForm clientSecret="pi_1_secret_2" orderId="SE-US-1" onSuccess={onSuccess} />);
    pay();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cartão recusado.');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('status que não é aprovado nem em processamento não encerra', async () => {
    mocks.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'requires_action' } });
    render(<StripeCardForm clientSecret="pi_1_secret_2" orderId="SE-US-1" onSuccess={onSuccess} />);
    pay();
    expect(await screen.findByRole('alert')).toHaveTextContent('Pagamento não confirmado');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
