import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PartnerStats from './PartnerStats';
import type { PartnerStats as Stats } from '@/services/affiliateService';

const stats: Stats = {
  visits: 40, linkVisits: 30, codeVisits: 10, signups: 8,
  buyers: { total: 5, registered: 3, guest: 2, orders: 6 },
  countries: { BR: 30, JP: 10 },
  regions: { 'BR-SP': 20, 'BR-RJ': 10 },
  cities: { 'São Paulo': 18 },
  devices: { mobile: 32, desktop: 8 },
  os: { iOS: 20, Android: 12, Windows: 8 },
};

describe('painel de visitas, cadastros e compras de um código', () => {
  it('mostra o funil: visitaram, se cadastraram, compraram e quem comprou com/sem cadastro', () => {
    render(<PartnerStats stats={stats} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('30 pelo link · 10 pelo código')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('20% de quem visitou')).toBeInTheDocument(); // 8/40 cadastros
    expect(screen.getByText('13% de quem visitou')).toBeInTheDocument(); // 5/40 compraram
    expect(screen.getByText(/com cadastro/)).toHaveTextContent('3 com cadastro');
    expect(screen.getByText(/sem cadastro/)).toHaveTextContent('2 sem cadastro');
    expect(screen.getByText('6 pedido(s) pago(s)')).toBeInTheDocument();
  });

  it('mostra aparelho, sistema, país e estado com porcentagem', () => {
    render(<PartnerStats stats={stats} />);
    expect(screen.getByText('Celular')).toBeInTheDocument();
    expect(screen.getByText('32 · 80%')).toBeInTheDocument();
    expect(screen.getByText('Computador')).toBeInTheDocument();
    expect(screen.getByText('iOS')).toBeInTheDocument();
    expect(screen.getByText('🇧🇷 Brasil')).toBeInTheDocument();
    expect(screen.getByText('🇯🇵 Japão')).toBeInTheDocument();
    expect(screen.getByText('Brasil · SP')).toBeInTheDocument();
  });

  it('cidade só aparece quando pedida (visão do admin)', () => {
    const { rerender } = render(<PartnerStats stats={stats} />);
    expect(screen.queryByText('São Paulo')).not.toBeInTheDocument();
    rerender(<PartnerStats stats={stats} showCities />);
    expect(screen.getByText('São Paulo')).toBeInTheDocument();
  });

  it('sem dados de local/aparelho explica que começa nas próximas visitas e não quebra com zeros', () => {
    const empty: Stats = { visits: 0, linkVisits: 0, codeVisits: 0, signups: 0, buyers: { total: 0, registered: 0, guest: 0, orders: 0 }, countries: {}, regions: {}, cities: {}, devices: {}, os: {} };
    render(<PartnerStats stats={empty} />);
    expect(screen.getByText(/começam a aparecer a partir das próximas visitas/)).toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  });

  it('não renderiza nada sem dados do servidor', () => {
    const { container } = render(<PartnerStats stats={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
