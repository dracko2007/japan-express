// Cupom de recuperação de carrinho: individual, de uma chance só.
//
//  - O código é por pessoa e por abandono (HMAC): `CARRINHOBACK15-A1B2C3D4E5`.
//  - Só vale se a pessoa ABRIR o link do e-mail (`/carrinho?rec=<código>.<chave>`). Digitar o
//    código no carrinho não basta: a chave do link é diferente do código e só vai no botão.
//  - Abrir o link começa uma janela (2 h). Passou da janela sem comprar, o cupom morre e o link
//    não abre de novo. A janela dá tempo de pagar com PIX/Wise em outro app, que é o jeito
//    comum de pagar na loja; invalidar ao fechar a aba puniria exatamente esse cliente.
//  - Um uso por CPF (ou por conta, fora do Brasil): ver `cpf_index.recoveryCouponCode`
//    (orders.js ao criar o pedido e fulfillment.js ao confirmar o pagamento).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

export const RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;
export const RECOVERY_CODE_PREFIX = 'CARRINHOBACK';

function secret() {
  const key = process.env.CART_RECOVERY_SECRET || process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!key) throw new Error('cart_recovery_secret_not_configured');
  return key;
}

/** Cada abandono recebe um código próprio (nunca um código global, que circularia). */
export function recoveryCouponCode(uid, abandonedAt, discount) {
  const suffix = createHmac('sha256', secret())
    .update(`${uid}:${abandonedAt}:${discount}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
  return `${RECOVERY_CODE_PREFIX}${discount}-${suffix}`;
}

/** Chave que só existe no link do e-mail (não dá para derivar do código impresso). */
export function recoveryLinkToken(code) {
  return createHmac('sha256', secret()).update(`open:${code}`).digest('base64url').slice(0, 32);
}

/** Valor do parâmetro `rec` do link: `<código>.<chave>`. */
export function recoveryLinkParam(code) {
  return `${code}.${recoveryLinkToken(code)}`;
}

/** Confere o parâmetro `rec` e devolve o código; qualquer adulteração é recusada. */
export function parseRecoveryLink(param) {
  const text = String(param || '');
  const dot = text.lastIndexOf('.');
  if (dot < 1) throw new HttpError(400, 'invalid_recovery_link');
  const code = text.slice(0, dot).toUpperCase();
  const given = Buffer.from(text.slice(dot + 1));
  const expected = Buffer.from(recoveryLinkToken(code));
  if (!/^[A-Z0-9_-]+$/.test(code) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(400, 'invalid_recovery_link');
  }
  return code;
}

/** 'not_opened' | 'open' | 'closed' */
export function recoveryWindowState(coupon, now = Date.now()) {
  if (coupon?.invalidatedAt) return 'closed';
  const openedAt = Number(coupon?.openedAt);
  if (!Number.isFinite(openedAt) || openedAt <= 0) return 'not_opened';
  return now <= Number(coupon?.windowEndsAt || 0) ? 'open' : 'closed';
}

/**
 * O cupom de recuperação só serve para quem recebeu o e-mail, DEPOIS de abrir o link e DENTRO da
 * janela. Usado no carrinho (validação), ao criar o pedido e no cálculo do total.
 */
export function assertRecoveryCouponUsable(coupon, uid, now = Date.now()) {
  if (coupon?.recovery !== true) return;
  if (coupon.recoveryOwnerUid && coupon.recoveryOwnerUid !== uid) throw new HttpError(403, 'coupon_not_eligible');
  const state = recoveryWindowState(coupon, now);
  if (state === 'not_opened') throw new HttpError(409, 'recovery_link_required');
  if (state === 'closed') throw new HttpError(409, 'recovery_window_closed');
}

/**
 * Abrir o link do e-mail: começa a janela. Idempotente dentro da janela (recarregar a página não
 * queima nada); depois dela o link não abre mais. Quem não é o dono do cupom é recusado SEM
 * gastar a chance dele.
 */
export async function openRecoveryCoupon(db, { link, user, now = Date.now() }) {
  const code = parseRecoveryLink(link);
  if (user.email_verified !== true || !user.email) throw new HttpError(403, 'verified_email_required');
  const ref = db.collection('coupons').doc(code);

  const outcome = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? (snap.data() || {}) : null;
    if (!data || data.recovery !== true) return { error: 'coupon_not_found' };
    if (data.recoveryOwnerUid !== user.uid) return { error: 'coupon_not_eligible' };
    if (data.isActive === false || !(Date.parse(data.expiryDate) > now)) return { error: 'coupon_unavailable' };
    if (Number(data.usedCount || 0) > 0) return { error: 'coupon_already_used' };

    const state = recoveryWindowState(data, now);
    if (state === 'closed') return { closed: true, invalidate: !data.invalidatedAt };
    if (state === 'open') return { code, coupon: data, windowEndsAt: Number(data.windowEndsAt), replay: true };

    const windowEndsAt = now + (Number(data.recoveryWindowMs) || RECOVERY_WINDOW_MS);
    transaction.update(ref, { openedAt: now, windowEndsAt, openedByUid: user.uid });
    return { code, coupon: { ...data, openedAt: now, windowEndsAt }, windowEndsAt, replay: false };
  });

  if (outcome.closed) {
    // Janela vencida: marca o cupom como invalidado para sempre (fora da transação, que só leu).
    if (outcome.invalidate) await ref.set({ invalidatedAt: now }, { merge: true }).catch(() => undefined);
    throw new HttpError(409, 'recovery_window_closed');
  }
  if (outcome.error) {
    throw new HttpError(outcome.error === 'coupon_not_found' ? 404 : outcome.error === 'coupon_not_eligible' ? 403 : 409, outcome.error);
  }
  return outcome;
}
