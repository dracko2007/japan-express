import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/services/authenticatedFetch', () => ({ authenticatedFetch: mocks.authenticatedFetch }));

const { openRecoveryLink, recoveryErrorMessage } = await import('./recoveryCouponService');

beforeEach(() => { mocks.authenticatedFetch.mockReset(); });

describe('openRecoveryLink', () => {
  it('manda o link ao servidor e devolve cupom e fim da janela', async () => {
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, coupon: { code: 'X', discountPercent: 15 }, windowEndsAt: 123, replay: false }) });
    const result = await openRecoveryLink('X.Y');
    expect(JSON.parse(mocks.authenticatedFetch.mock.calls[0][1].body)).toEqual({ link: 'X.Y' });
    expect(mocks.authenticatedFetch.mock.calls[0][0]).toBe('/api/recovery-open');
    expect(result).toEqual({ ok: true, coupon: { code: 'X', discountPercent: 15 }, windowEndsAt: 123, replay: false });
  });

  it('devolve o código do erro do servidor', async () => {
    mocks.authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'recovery_window_closed' }) });
    expect(await openRecoveryLink('X.Y')).toEqual({ ok: false, error: 'recovery_window_closed' });
  });

  it('falha de rede vira erro "network", sem lançar', async () => {
    mocks.authenticatedFetch.mockImplementation(() => { throw new Error('offline'); });
    expect(await openRecoveryLink('X.Y')).toEqual({ ok: false, error: 'network' });
  });
});

describe('mensagens', () => {
  it('explicam cada motivo e só reconhecem códigos conhecidos', () => {
    expect(recoveryErrorMessage('recovery_link_required')).toMatch(/botão do e-mail/);
    expect(recoveryErrorMessage('recovery_window_closed')).toMatch(/24 horas/);
    expect(recoveryErrorMessage('recovery_coupon_cpf_used')).toMatch(/uma vez só/);
    expect(recoveryErrorMessage('qualquer_coisa')).toBe('');
    expect(recoveryErrorMessage(undefined)).toBe('');
  });
});
