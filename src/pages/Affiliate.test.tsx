import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  user: null as null | { email: string; name: string },
  request: null as null | { status: string },
  requestAffiliate: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/components/layout/Layout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/context/UserContext', () => ({ useUser: () => ({ user: mocks.user, isAuthenticated: Boolean(mocks.user) }) }));
vi.mock('@/context/ProductsContext', () => ({ useProducts: () => ({ products: [] }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/fxService', () => ({ convertYen: (v: number) => v, loadFxRates: async () => ({}) }));
vi.mock('@/services/affiliateService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/affiliateService')>();
  return {
    ...original,
    affiliateService: {
      getByOwnerEmail: vi.fn(async () => []),
      getMyRequest: vi.fn(async () => mocks.request),
      requestAffiliate: mocks.requestAffiliate,
    },
  };
});

const { default: AffiliatePage } = await import('./Affiliate');
const renderPage = () => render(<MemoryRouter><AffiliatePage /></MemoryRouter>);

beforeEach(() => {
  mocks.user = null;
  mocks.request = null;
  mocks.requestAffiliate.mockClear();
});

describe('página Afilie-se (aberta, sem convite)', () => {
  it('visitante vê a explicação, os níveis e o caminho para entrar e se afiliar', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Afilie-se' })).toBeInTheDocument();
    expect(screen.getByText('Bronze')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar e me afiliar' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/programa de afiliados é por convite/i)).not.toBeInTheDocument();
  });

  it('cliente logado pede a afiliação com um clique', async () => {
    mocks.user = { email: 'cliente@example.com', name: 'Cliente' };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Quero me afiliar/ }));
    await waitFor(() => expect(mocks.requestAffiliate).toHaveBeenCalledWith('Cliente', 'cliente@example.com'));
    expect(await screen.findByText(/Seu pedido está em análise/)).toBeInTheDocument();
  });

  it('pedido já enviado mostra "em análise" em vez do botão', async () => {
    mocks.user = { email: 'cliente@example.com', name: 'Cliente' };
    mocks.request = { status: 'pending' };
    renderPage();
    expect(await screen.findByText(/Seu pedido está em análise/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quero me afiliar/ })).not.toBeInTheDocument();
  });
});
