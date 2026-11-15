import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CustomerStats } from '@/services/customerService';

const mocks = vi.hoisted(() => ({ customers: [] as unknown[] }));

vi.mock('@/services/affiliateService', () => ({ affiliateService: { getRequests: vi.fn(async () => []) } }));
vi.mock('@/services/customerService', () => ({
  customerService: {
    getAllCustomersAsync: vi.fn(async () => mocks.customers),
    getCustomerOverviewAsync: vi.fn(async () => null),
    getCustomerVerificationAsync: vi.fn(async () => new Map()),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/firebaseSyncService', () => ({ firebaseSyncService: {} }));
vi.mock('@/services/negotiationService', () => ({ negotiationService: {} }));
vi.mock('@/services/promoCampaignService', () => ({ promoCampaignService: {} }));
vi.mock('@/utils/adminAuth', () => ({ ensureAdminAuth: vi.fn() }));
vi.mock('@/components/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }));
vi.mock('@/services/orderService', () => ({ orderService: {} }));
vi.mock('@/context/UserContext', () => ({ useUser: () => ({ permissions: {} }) }));
vi.mock('@/services/mailService', () => ({ resendVerificationAsAdmin: vi.fn() }));

const { default: CustomerList } = await import('./CustomerList');

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const customer = (over: Partial<CustomerStats>): CustomerStats => ({
  email: 'x@example.com', name: 'X', phone: 'N/A', totalOrders: 0, totalSpent: 0, averageOrderValue: 0, lastOrderDate: null,
  favoriteProducts: [], orderHistory: [], ...over,
});

beforeEach(() => {
  localStorage.clear();
  mocks.customers = [
    customer({ email: 'antiga@example.com', name: 'Cliente Antiga', totalSpent: 90000, totalOrders: 5, createdAt: daysAgo(400) }),
    customer({ email: 'maria@example.com', name: 'Maria Nova', createdAt: daysAgo(1) }),
    customer({ email: 'joao@example.com', name: 'João Novo', createdAt: daysAgo(0.2) }),
  ];
});

describe('aba Clientes: quem é o cliente novo', () => {
  it('marca com bolinha vermelha e "Novo" quem criou a conta há pouco, e mostra "Cliente desde"', async () => {
    render(<CustomerList />);
    expect(await screen.findByText('Maria Nova')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Cliente novo' })).toHaveLength(2);
    const maria = screen.getByText('Maria Nova').closest('.cursor-pointer') as HTMLElement;
    expect(within(maria).getByText('Novo')).toBeInTheDocument();
    expect(within(maria).getByText(/Cliente desde .* \(há 1 dia\)/)).toBeInTheDocument();
    const antiga = screen.getByText('Cliente Antiga').closest('.cursor-pointer') as HTMLElement;
    expect(within(antiga).queryByText('Novo')).not.toBeInTheDocument();
    expect(within(antiga).getByText(/Cliente desde .* \(há 1 ano\)/)).toBeInTheDocument();
  });

  it('os novos aparecem primeiro, mesmo sem pedidos', async () => {
    render(<CustomerList />);
    await screen.findByText('Maria Nova');
    const names = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(names.indexOf('Cliente Antiga')).toBeGreaterThan(names.indexOf('Maria Nova'));
    expect(names.indexOf('Cliente Antiga')).toBeGreaterThan(names.indexOf('João Novo'));
  });

  it('o filtro "Novos" mostra só eles; abrir o cliente tira a bolinha daquele e lembra no navegador', async () => {
    const { unmount } = render(<CustomerList />);
    fireEvent.click(await screen.findByRole('button', { name: /Novos \(2\)/ }));
    expect(screen.queryByText('Cliente Antiga')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Maria Nova'));
    expect(screen.getAllByRole('img', { name: 'Cliente novo' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Novos \(1\)/ })).toBeInTheDocument();

    // Reabrir o painel: continua visto.
    unmount();
    render(<CustomerList />);
    await screen.findByText('Maria Nova');
    expect(screen.getAllByRole('img', { name: 'Cliente novo' })).toHaveLength(1);
  });

  it('"Marcar todos como vistos" limpa as bolinhas e o filtro', async () => {
    render(<CustomerList />);
    await screen.findByText('Maria Nova');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos como vistos' }));
    expect(screen.queryByRole('img', { name: 'Cliente novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novos \(/ })).not.toBeInTheDocument();
    expect(screen.getByText('Cliente Antiga')).toBeInTheDocument();
  });
});
