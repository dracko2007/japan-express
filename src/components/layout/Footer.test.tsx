// Rodapé: formas de pagamento seguem as configurações do checkout (cartão agora, Pix em breve).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ settings: { cardEnabled: true, pixEnabled: false }, country: 'Brasil' }));

vi.mock('@/services/paymentSettingsService', () => ({ paymentSettingsService: { get: async () => mocks.settings } }));
vi.mock('@/hooks/usePWAInstall', () => ({ usePWAInstall: () => ({ platform: 'other', isInstalled: false, install: vi.fn() }) }));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    selectedCountry: mocks.country,
    t: (key: string) => ({ 'footer.payments': 'Formas de pagamento', 'footer.paymentCard': 'Cartão de crédito', 'footer.paymentSoon': 'em breve' }[key] ?? key),
  }),
}));

import Footer from './Footer';

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('Footer: formas de pagamento', () => {
  beforeEach(() => { mocks.settings = { cardEnabled: true, pixEnabled: false }; mocks.country = 'Brasil'; });

  it('cartão de crédito agora e Pix marcado como em breve', async () => {
    renderFooter();
    expect(await screen.findByText('Cartão de crédito')).toBeInTheDocument();
    expect(screen.getByText('(em breve)')).toBeInTheDocument();
  });

  it('com o Pix ligado nas configurações, some o "em breve"', async () => {
    mocks.settings = { cardEnabled: true, pixEnabled: true };
    renderFooter();
    await screen.findByText('Cartão de crédito');
    await waitFor(() => expect(screen.queryByText('(em breve)')).not.toBeInTheDocument());
  });

  it('cartão desligado não é anunciado', async () => {
    mocks.settings = { cardEnabled: false, pixEnabled: false };
    renderFooter();
    await screen.findByText('Pix'); // o bloco já carregou
    expect(screen.queryByText('Cartão de crédito')).not.toBeInTheDocument();
  });

  it('na loja do Japão o bloco não aparece (lá se paga por banco/PayPay)', () => {
    mocks.country = 'Japão';
    renderFooter();
    expect(screen.queryByText('Formas de pagamento')).not.toBeInTheDocument();
  });
});
