// Área da conta: menu de seções (barra lateral no desktop, seletor no celular) e uma seção por vez.
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileShell from './ProfileShell';
import ProfileOverview from './ProfileOverview';
import { parseSection } from './profileSections';

const t = (key: string) => key;

const setup = (props: Partial<React.ComponentProps<typeof ProfileShell>> = {}) => {
  const onSelect = vi.fn();
  const onLogout = vi.fn();
  render(
    <ProfileShell t={t} title="Minha conta" name="Ana" email="ana@x.com" active="visao-geral" onSelect={onSelect} onLogout={onLogout} logoutLabel="Sair" {...props}>
      <p>conteúdo</p>
    </ProfileShell>,
  );
  return { onSelect, onLogout };
};

describe('parseSection', () => {
  it('aceita os ids conhecidos e cai na visão geral para o resto', () => {
    expect(parseSection('pedidos')).toBe('pedidos');
    expect(parseSection('afiliado')).toBe('afiliado');
    for (const bad of [null, '', 'admin', 'PEDIDOS', '__proto__']) expect(parseSection(bad)).toBe('visao-geral');
  });
});

describe('ProfileShell', () => {
  it('mostra nome, e-mail e o conteúdo da seção', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument();
    expect(screen.getByText('Ana · ana@x.com')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('menu lateral: marca a seção atual e troca de seção ao clicar', () => {
    const { onSelect } = setup({ active: 'pedidos' });
    const nav = screen.getAllByRole('navigation')[0];
    expect(within(nav).getByRole('button', { name: 'profile.nav.orders' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'profile.nav.coupons' })).not.toHaveAttribute('aria-current');
    fireEvent.click(within(nav).getByRole('button', { name: 'profile.nav.coupons' }));
    expect(onSelect).toHaveBeenCalledWith('cupons');
  });

  it('celular: o seletor tem as mesmas seções e troca de seção', () => {
    const { onSelect } = setup();
    const select = screen.getByRole('combobox', { name: 'profile.nav.label' });
    expect(within(select).getAllByRole('option')).toHaveLength(8);
    fireEvent.change(select, { target: { value: 'dados' } });
    expect(onSelect).toHaveBeenCalledWith('dados');
  });

  it('contador de cupons só aparece quando for maior que zero', () => {
    setup({ badges: { cupons: 3, pedidos: 0 } });
    const nav = screen.getAllByRole('navigation')[0];
    expect(within(nav).getByRole('button', { name: /profile\.nav\.coupons/ })).toHaveTextContent('3');
    expect(within(nav).getByRole('button', { name: /profile\.nav\.orders/ })).not.toHaveTextContent('0');
  });

  it('sair está no menu e também no fim da página (celular)', () => {
    const { onLogout } = setup();
    const botoes = screen.getAllByRole('button', { name: 'Sair' });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[0]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileOverview', () => {
  it('cada número leva à sua seção', () => {
    const onSelect = vi.fn();
    render(<ProfileOverview t={t} points={120} ordersCount={4} activeCoupons={2} tierName="prata" onSelect={onSelect} />);
    expect(screen.getByText('120')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /profile\.overview\.orders/ }));
    fireEvent.click(screen.getByRole('button', { name: /profile\.overview\.coupons/ }));
    fireEvent.click(screen.getByRole('button', { name: /profile\.overview\.points/ }));
    expect(onSelect.mock.calls.map(([id]) => id)).toEqual(['pedidos', 'cupons', 'recompensas']);
    expect(screen.getByText('prata')).toBeInTheDocument();
  });
});
