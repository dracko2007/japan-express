import { safeStorage } from '@/utils/storage';

/**
 * Cupom de recuperação de carrinho que o cliente abriu pelo e-mail e ainda está na janela de 24 h.
 * Fica guardado no aparelho para o carrinho reaplicar o cupom quando ele voltar de outras páginas
 * (juntar mais produtos) e para o popup de saída avisar. O servidor é quem manda: se a janela já
 * fechou lá, o pedido é recusado de qualquer jeito (`api/_lib/recovery-coupon.js`).
 */
export interface RecoveryCouponState {
  code: string;
  discountPercent: number;
  description?: string;
  expiryDate?: string;
  /** Fim da janela (ms desde 1970). */
  endsAt: number;
}

const KEY = 'recovery_coupon_state';

const isState = (value: unknown): value is RecoveryCouponState => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === 'string' && v.code !== ''
    && typeof v.discountPercent === 'number' && Number.isFinite(v.discountPercent)
    && typeof v.endsAt === 'number' && Number.isFinite(v.endsAt);
};

export const recoveryCouponState = {
  /** O estado ativo, ou null (nada guardado, ilegível ou janela vencida — nesse caso já limpa). */
  get(now: number = Date.now()): RecoveryCouponState | null {
    try {
      const raw = safeStorage.getItem(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isState(parsed) || parsed.endsAt <= now) {
        safeStorage.removeItem(KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },
  set(state: RecoveryCouponState): void {
    safeStorage.setItem(KEY, JSON.stringify(state));
  },
  clear(): void {
    safeStorage.removeItem(KEY);
  },
};
