// Rodapé: formas de pagamento (com os logos) seguem as configurações do checkout.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ settings: { cardEnabled: true, wiseEnabled: true, pixEnabled: false }, country: 'Brasil' }));

vi.mock('@/services/paymentSettingsService', () => ({ paymentSettingsService: { get: async () => mocks.settings } }));
vi.mock('@/hooks/usePWAInstall', () => ({ usePWAInstall: () => ({ platform: 'other', isInstalled: false, install: vi.fn() }) }));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'pt',
    selectedCountry: mocks.country,
    t: (key: string) => ({ 'footer.payments': 'Formas de pagamento', 'footer.paymentSoon': 'em breve', 'footer.paymentPixViaWise': 'disponível via Wise' }[key] ?? key),
  }),
}));

import Footer from './Footer';

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);
const logo = (name: string) => screen.queryByRole('img', { name });

describe('Footer: formas de pagamento', () => {
  beforeEach(() => { mocks.settings = { cardEnabled: true, wiseEnabled: true, pixEnabled: false }; mocks.country = 'Brasil'; });

  it('mostra os logos de cartão, Wise e Pix, com o Pix "disponível via Wise"', async () => {
    renderFooter();
    expect(await screen.findByRole('img', { name: 'Visa' })).toBeInTheDocument();
    for (const name of ['Mastercard', 'American Express', 'Diners Club', 'Wise', 'Pix']) expect(logo(name)).toBeInTheDocument();
    expect(screen.getByText('Pix: disponível via Wise')).toBeInTheDocument();
  });

  it('com o Pix ligado nas configurações, não aparece nenhuma observação', async () => {
    mocks.settings = { cardEnabled: true, wiseEnabled: true, pixEnabled: true };
    renderFooter();
    await screen.findByRole('img', { name: 'Visa' });
    expect(screen.queryByText(/^Pix:/)).not.toBeInTheDocument();
  });

  it('sem Wise e sem Pix, o Pix aparece como em breve (nunca como disponível)', async () => {
    mocks.settings = { cardEnabled: true, wiseEnabled: false, pixEnabled: false };
    renderFooter();
    await screen.findByRole('img', { name: 'Visa' });
    expect(screen.getByText('Pix: em breve')).toBeInTheDocument();
    expect(screen.queryByText('Pix: disponível via Wise')).not.toBeInTheDocument();
    expect(logo('Wise')).not.toBeInTheDocument();
  });

  it('cartão e Wise desligados não são anunciados', async () => {
    mocks.settings = { cardEnabled: false, wiseEnabled: false, pixEnabled: false };
    renderFooter();
    await screen.findByRole('img', { name: 'Pix' }); // o bloco já carregou
    for (const name of ['Visa', 'Mastercard', 'American Express', 'Diners Club', 'Wise']) expect(logo(name)).not.toBeInTheDocument();
  });

  it('o bloco fica no contato, logo depois do WhatsApp', async () => {
    renderFooter();
    const titulo = await screen.findByText('Formas de pagamento');
    const whatsapp = screen.getByText(/WhatsApp:/);
    // o título vem depois do WhatsApp na mesma coluna
    expect(whatsapp.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(whatsapp.closest('div')?.parentElement).toBe(titulo.closest('div')?.parentElement?.parentElement ?? titulo.closest('div')?.parentElement);
  });

  it('na loja do Japão o bloco não aparece (lá se paga por banco/PayPay)', () => {
    mocks.country = 'Japão';
    renderFooter();
    expect(screen.queryByText('Formas de pagamento')).not.toBeInTheDocument();
  });
});
