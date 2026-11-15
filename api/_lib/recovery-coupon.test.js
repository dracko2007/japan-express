import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECOVERY_WINDOW_MS,
  assertRecoveryCouponUsable,
  openRecoveryCoupon,
  parseRecoveryLink,
  recoveryCouponCode,
  recoveryLinkParam,
  recoveryWindowState,
} from './recovery-coupon.js';

const NOW = Date.parse('2026-11-16T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const code = () => recoveryCouponCode('uid1', 1700000000000, 15);

beforeEach(() => { process.env.UNSUBSCRIBE_SECRET = 'segredo-de-teste'; });

class FakeDb {
  constructor(docs) { this.docs = docs; }
  collection(name) {
    const db = this;
    return {
      doc: (id) => {
        const ref = { path: `${name}/${id}` };
        ref.set = async (value, options) => { db.docs[ref.path] = options?.merge ? { ...db.docs[ref.path], ...value } : value; };
        return ref;
      },
    };
  }
  async runTransaction(work) {
    return work({
      get: async ({ path }) => ({ exists: path in this.docs, data: () => structuredClone(this.docs[path]) }),
      update: ({ path }, value) => { this.docs[path] = { ...this.docs[path], ...value }; },
    });
  }
}

const coupon = (extra = {}) => ({
  code: code(), recovery: true, recoveryOwnerUid: 'uid1', recoveryWindowMs: RECOVERY_WINDOW_MS,
  isActive: true, expiryDate: new Date(NOW + 48 * HOUR).toISOString(), usedCount: 0, openedAt: null, windowEndsAt: null, ...extra,
});
const user = (extra = {}) => ({ uid: 'uid1', email: 'ana@example.com', email_verified: true, ...extra });
const open = (db, who = user(), now = NOW) => openRecoveryCoupon(db, { link: recoveryLinkParam(code()), user: who, now });

describe('código e link do cupom de recuperação', () => {
  it('o código é individual, tem o nome CARRINHOBACK<desconto> e muda por abandono', () => {
    expect(code()).toMatch(/^CARRINHOBACK15-[A-F0-9]{10}$/);
    expect(recoveryCouponCode('uid1', 1700000000000, 15)).toBe(code());
    expect(recoveryCouponCode('uid2', 1700000000000, 15)).not.toBe(code());
    expect(recoveryCouponCode('uid1', 1700000099999, 15)).not.toBe(code());
  });

  it('a chave do link não é o código e qualquer adulteração é recusada', () => {
    const param = recoveryLinkParam(code());
    expect(parseRecoveryLink(param)).toBe(code());
    expect(() => parseRecoveryLink(code())).toThrow(expect.objectContaining({ code: 'invalid_recovery_link' }));
    expect(() => parseRecoveryLink(`${code()}.${'A'.repeat(32)}`)).toThrow(expect.objectContaining({ code: 'invalid_recovery_link' }));
    expect(() => parseRecoveryLink(param.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).toThrow(expect.objectContaining({ code: 'invalid_recovery_link' }));
    // Trocar o código por outro (mesma chave) também não passa.
    const other = recoveryCouponCode('uid9', 1, 15);
    expect(() => parseRecoveryLink(`${other}.${param.split('.')[1]}`)).toThrow(expect.objectContaining({ code: 'invalid_recovery_link' }));
  });
});

describe('janela: só depois de abrir o link, só por 2 horas', () => {
  it('estados da janela', () => {
    expect(recoveryWindowState(coupon(), NOW)).toBe('not_opened');
    expect(recoveryWindowState(coupon({ openedAt: NOW, windowEndsAt: NOW + 2 * HOUR }), NOW + HOUR)).toBe('open');
    expect(recoveryWindowState(coupon({ openedAt: NOW, windowEndsAt: NOW + 2 * HOUR }), NOW + 2 * HOUR + 1)).toBe('closed');
    expect(recoveryWindowState(coupon({ openedAt: NOW, windowEndsAt: NOW + 2 * HOUR, invalidatedAt: NOW }), NOW + 1)).toBe('closed');
  });

  it('digitar o código sem ter aberto o link é recusado; dentro da janela passa; depois dela, não', () => {
    expect(() => assertRecoveryCouponUsable(coupon(), 'uid1', NOW)).toThrow(expect.objectContaining({ code: 'recovery_link_required', statusCode: 409 }));
    const aberto = coupon({ openedAt: NOW, windowEndsAt: NOW + 2 * HOUR });
    expect(() => assertRecoveryCouponUsable(aberto, 'uid1', NOW + HOUR)).not.toThrow();
    expect(() => assertRecoveryCouponUsable(aberto, 'uid1', NOW + 3 * HOUR)).toThrow(expect.objectContaining({ code: 'recovery_window_closed' }));
    // Outra conta, mesmo com a janela aberta.
    expect(() => assertRecoveryCouponUsable(aberto, 'uid-outro', NOW + HOUR)).toThrow(expect.objectContaining({ code: 'coupon_not_eligible' }));
  });

  it('cupom comum (sem recovery) não é afetado', () => {
    expect(() => assertRecoveryCouponUsable({ code: 'BEMVINDO10' }, 'uid1', NOW)).not.toThrow();
  });
});

describe('abrir o link do e-mail', () => {
  it('começa a janela de 2 h e devolve o cupom; recarregar dentro da janela não queima nada', async () => {
    const db = new FakeDb({ [`coupons/${code()}`]: coupon() });
    const first = await open(db);
    expect(first.windowEndsAt).toBe(NOW + 2 * HOUR);
    expect(first.replay).toBe(false);
    expect(db.docs[`coupons/${code()}`]).toMatchObject({ openedAt: NOW, windowEndsAt: NOW + 2 * HOUR, openedByUid: 'uid1' });

    const again = await open(db, user(), NOW + 30 * 60 * 1000);
    expect(again.replay).toBe(true);
    expect(again.windowEndsAt).toBe(NOW + 2 * HOUR); // a janela não anda
  });

  it('saiu sem comprar e voltou depois da janela: o cupom morre e o link não abre de novo', async () => {
    const db = new FakeDb({ [`coupons/${code()}`]: coupon() });
    await open(db);
    await expect(open(db, user(), NOW + 3 * HOUR)).rejects.toMatchObject({ code: 'recovery_window_closed', statusCode: 409 });
    expect(db.docs[`coupons/${code()}`].invalidatedAt).toBe(NOW + 3 * HOUR);
    // Mesmo "voltando no tempo", continua invalidado.
    await expect(open(db, user(), NOW + 1)).rejects.toMatchObject({ code: 'recovery_window_closed' });
  });

  it('quem não é o dono é recusado SEM gastar a chance do dono', async () => {
    const db = new FakeDb({ [`coupons/${code()}`]: coupon() });
    await expect(open(db, user({ uid: 'intruso', email: 'x@example.com' }))).rejects.toMatchObject({ code: 'coupon_not_eligible', statusCode: 403 });
    expect(db.docs[`coupons/${code()}`].openedAt).toBeNull();
    expect((await open(db)).replay).toBe(false); // o dono ainda tem a chance inteira
  });

  it('exige e-mail verificado (o cupom é nominal) e não queima a chance sem isso', async () => {
    const db = new FakeDb({ [`coupons/${code()}`]: coupon() });
    await expect(open(db, user({ email_verified: false }))).rejects.toMatchObject({ code: 'verified_email_required' });
    expect(db.docs[`coupons/${code()}`].openedAt).toBeNull();
  });

  it('recusa cupom já usado, vencido, desativado ou inexistente; e chave adulterada', async () => {
    const usado = new FakeDb({ [`coupons/${code()}`]: coupon({ usedCount: 1 }) });
    await expect(open(usado)).rejects.toMatchObject({ code: 'coupon_already_used' });
    const vencido = new FakeDb({ [`coupons/${code()}`]: coupon({ expiryDate: new Date(NOW - HOUR).toISOString() }) });
    await expect(open(vencido)).rejects.toMatchObject({ code: 'coupon_unavailable' });
    const inativo = new FakeDb({ [`coupons/${code()}`]: coupon({ isActive: false }) });
    await expect(open(inativo)).rejects.toMatchObject({ code: 'coupon_unavailable' });
    await expect(open(new FakeDb({}))).rejects.toMatchObject({ code: 'coupon_not_found', statusCode: 404 });
    await expect(openRecoveryCoupon(new FakeDb({ [`coupons/${code()}`]: coupon() }), { link: `${code()}.${'Z'.repeat(32)}`, user: user(), now: NOW }))
      .rejects.toMatchObject({ code: 'invalid_recovery_link', statusCode: 400 });
  });

  it('um cupom comum não pode ser "aberto" como se fosse de recuperação', async () => {
    const db = new FakeDb({ [`coupons/${code()}`]: { code: code(), isActive: true, expiryDate: new Date(NOW + HOUR).toISOString() } });
    await expect(open(db)).rejects.toMatchObject({ code: 'coupon_not_found' });
  });
});
