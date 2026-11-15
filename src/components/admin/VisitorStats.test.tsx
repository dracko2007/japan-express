import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getCodeStats: vi.fn(),
}));

vi.mock('@/services/visitorService', () => ({
  visitorService: {
    getSummary: vi.fn(async () => ({
      totalVisits: 50, avgPerDay: 5,
      topCountries: [{ code: 'BR', count: 40 }], topCities: [{ city: 'São Paulo', count: 20 }],
      devices: { mobile: 35, desktop: 15 }, os: { iOS: 20, Windows: 15 },
      dailyData: [{ date: '2026-11-14', total: 5, countries: {}, cities: {} }],
    })),
    getTopPages: vi.fn(async () => []),
    getTopProducts: vi.fn(async () => []),
  },
}));
vi.mock('@/services/affiliateService', () => ({ affiliateService: { getCodeStats: mocks.getCodeStats } }));

const { default: VisitorStats } = await import('./VisitorStats');

const empty = { visits: 0, linkVisits: 0, codeVisits: 0, signups: 0, buyers: { total: 0, registered: 0, guest: 0, orders: 0 }, countries: {}, regions: {}, cities: {}, devices: {}, os: {} };

beforeEach(() => {
  mocks.getCodeStats.mockReset();
});

describe('aba Visitantes: aparelhos e parceiros', () => {
  it('mostra o aparelho dos visitantes do site na visão geral', async () => {
    render(<VisitorStats />);
    expect(await screen.findByText('Aparelhos')).toBeInTheDocument();
    expect(screen.getByText('Celular')).toBeInTheDocument();
    expect(screen.getByText('35 · 70%')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();
  });

  it('aba Parceiros: totais e uma linha por código, com cadastro e compradores', async () => {
    mocks.getCodeStats.mockResolvedValue({
      totals: { ...empty, visits: 12, signups: 3, buyers: { total: 2, registered: 1, guest: 1, orders: 2 }, devices: { mobile: 9, desktop: 3 }, countries: { BR: 12 } },
      codes: {
        VIDEO1: { ...empty, kind: 'promoter', visits: 9, signups: 2, buyers: { total: 1, registered: 1, guest: 0, orders: 1 }, devices: { mobile: 7, desktop: 2 } },
        AMIGA10: { ...empty, kind: 'affiliate', visits: 3, signups: 1, buyers: { total: 1, registered: 0, guest: 1, orders: 1 }, devices: { desktop: 3 } },
      },
    });
    render(<VisitorStats />);
    fireEvent.click(await screen.findByRole('button', { name: /Parceiros/ }));
    expect(await screen.findByText('Todos os links e códigos de parceiros')).toBeInTheDocument();
    expect(mocks.getCodeStats).toHaveBeenCalledWith(true);
    const row = (await screen.findByText('VIDEO1')).closest('tr')!;
    expect(row).toHaveTextContent('Divulgador');
    expect(row).toHaveTextContent('Celular');
    const afiliada = screen.getByText('AMIGA10').closest('tr')!;
    expect(afiliada).toHaveTextContent('Afiliado');
    expect(afiliada).toHaveTextContent('Computador');
    // VIDEO1 (9 visitas) vem antes de AMIGA10 (3).
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('VIDEO1');
  });

  it('aba Parceiros: avisa quando não conseguiu carregar', async () => {
    mocks.getCodeStats.mockResolvedValue(null);
    render(<VisitorStats />);
    fireEvent.click(await screen.findByRole('button', { name: /Parceiros/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os parceiros');
  });
});
