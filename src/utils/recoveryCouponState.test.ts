import { beforeEach, describe, expect, it } from 'vitest';
import { formatCountdown } from '@/utils/countdown';
import { recoveryCouponState } from '@/utils/recoveryCouponState';

const NOW = 1_800_000_000_000;
const state = (extra = {}) => ({ code: 'CARRINHOBACK15-AB12', discountPercent: 15, endsAt: NOW + 3_600_000, ...extra });

describe('recoveryCouponState', () => {
  beforeEach(() => recoveryCouponState.clear());

  it('guarda e devolve o cupom enquanto a janela está aberta', () => {
    recoveryCouponState.set(state());
    expect(recoveryCouponState.get(NOW)).toEqual(state());
  });

  it('janela vencida: devolve null e já limpa', () => {
    recoveryCouponState.set(state());
    expect(recoveryCouponState.get(NOW + 3_600_001)).toBeNull();
    expect(recoveryCouponState.get(NOW)).toBeNull(); // foi apagado, não só ignorado
  });

  it('conteúdo ilegível ou incompleto é ignorado', () => {
    localStorage.setItem('recovery_coupon_state', '{não é json');
    expect(recoveryCouponState.get(NOW)).toBeNull();
    localStorage.setItem('recovery_coupon_state', JSON.stringify({ code: 'X' }));
    expect(recoveryCouponState.get(NOW)).toBeNull();
  });

  it('clear apaga', () => {
    recoveryCouponState.set(state());
    recoveryCouponState.clear();
    expect(recoveryCouponState.get(NOW)).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('formata HH:MM:SS', () => {
    expect(formatCountdown(24 * 3_600_000)).toBe('24:00:00');
    expect(formatCountdown(86_399_000)).toBe('23:59:59');
    expect(formatCountdown(61_000)).toBe('00:01:01');
  });
  it('nunca fica negativo', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
    expect(formatCountdown(0)).toBe('00:00:00');
  });
});
