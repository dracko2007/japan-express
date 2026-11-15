import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/services/recoveryCouponService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/recoveryCouponService')>()),
  openRecoveryLink: mocks.open,
}));

const { useRecoveryLink } = await import('./useRecoveryLink');

const wrapper = (url: string) => ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
const COUPON = { code: 'CARRINHOBACK15-ABCDEF1234', discountPercent: 15 };

function setup(url: string, options: Partial<Parameters<typeof useRecoveryLink>[0]> = {}) {
  const callbacks = { onOpened: vi.fn(), onError: vi.fn(), onExpired: vi.fn() };
  const hook = renderHook(() => ({ recovery: useRecoveryLink({ authReady: true, isAuthenticated: true, ...callbacks, ...options }), location: useLocation() }), { wrapper: wrapper(url) });
  return { ...hook, ...callbacks };
}

beforeEach(() => { mocks.open.mockReset(); });

describe('link do e-mail de recuperação de carrinho', () => {
  it('abre o link, aplica o cupom e tira o ?rec= da barra', async () => {
    const endsAt = Date.now() + 2 * 3600000;
    mocks.open.mockResolvedValue({ ok: true, coupon: COUPON, windowEndsAt: endsAt, replay: false });
    const { result, onOpened } = setup('/carrinho?rec=CODIGO.CHAVE');
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(COUPON, endsAt));
    expect(mocks.open).toHaveBeenCalledWith('CODIGO.CHAVE');
    expect(result.current.recovery.endsAt).toBe(endsAt);
    expect(result.current.location.search).toBe('');
  });

  it('sem login, leva ao login e volta para o mesmo link; não abre nada antes', async () => {
    const { result } = setup('/carrinho?rec=CODIGO.CHAVE', { isAuthenticated: false });
    await waitFor(() => expect(result.current.location.pathname).toBe('/login'));
    expect(result.current.location.state).toEqual({ from: '/carrinho?rec=CODIGO.CHAVE' });
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('espera a sessão ser conhecida antes de decidir (sem piscar o login)', () => {
    const { result } = setup('/carrinho?rec=CODIGO.CHAVE', { authReady: false, isAuthenticated: false });
    expect(result.current.location.pathname).toBe('/carrinho');
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando o link não vale (janela fechada, dono errado, chave inválida)', async () => {
    mocks.open.mockResolvedValue({ ok: false, error: 'recovery_window_closed' });
    const { onError, onOpened } = setup('/carrinho?rec=CODIGO.CHAVE');
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('prazo deste cupom acabou')));
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('erro desconhecido ou de rede cai numa mensagem útil', async () => {
    mocks.open.mockResolvedValue({ ok: false, error: 'network' });
    const { onError } = setup('/carrinho?rec=CODIGO.CHAVE');
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('botão do e-mail')));
  });

  it('sem ?rec= não faz nada', () => {
    setup('/carrinho');
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('quando a janela vence com a tela aberta, avisa para tirar o cupom', async () => {
    vi.useFakeTimers();
    mocks.open.mockResolvedValue({ ok: true, coupon: COUPON, windowEndsAt: Date.now() + 20_000, replay: false });
    const { onExpired } = setup('/carrinho?rec=CODIGO.CHAVE');
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(onExpired).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
