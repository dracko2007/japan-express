import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/recovery-open: abre o link do e-mail de recuperação de carrinho.
const mocks = vi.hoisted(() => ({ limit: vi.fn(), user: null, docs: {} }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({
  requireUser: async () => {
    if (!mocks.user) { const { HttpError } = await import('./http.js'); throw new HttpError(401, 'unauthorized'); }
    return mocks.user;
  },
}));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => ({
    collection: (name) => ({
      doc: (id) => ({ path: `${name}/${id}`, get: async () => ({ exists: `${name}/${id}` in mocks.docs, data: () => structuredClone(mocks.docs[`${name}/${id}`]) }), set: async (value) => { mocks.docs[`${name}/${id}`] = { ...mocks.docs[`${name}/${id}`], ...value }; } }),
    }),
    runTransaction: async (work) => work({
      get: async ({ path }) => ({ exists: path in mocks.docs, data: () => structuredClone(mocks.docs[path]) }),
      update: ({ path }, value) => { mocks.docs[path] = { ...mocks.docs[path], ...value }; },
    }),
  }),
}));

const { default: handler } = await import('../coupons.js');
const { recoveryCouponCode, recoveryLinkParam, RECOVERY_WINDOW_MS } = await import('./recovery-coupon.js');

const code = () => recoveryCouponCode('uid1', 1700000000000, 15);

async function call(body, query = { action: 'recovery-open' }) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(n, v) { this.headers[n] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; }, end() { return this; } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, query, body }, res);
  return res;
}

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = 'segredo-de-teste';
  mocks.limit.mockReset();
  mocks.user = { uid: 'uid1', email: 'ana@example.com', email_verified: true };
  mocks.docs = {
    [`coupons/${code()}`]: {
      code: code(), recovery: true, recoveryOwnerUid: 'uid1', recoveryWindowMs: RECOVERY_WINDOW_MS, isActive: true,
      type: 'percent', discount: 0, discountPercent: 15, description: 'Recuperacao', targetType: 'specific', targetEmails: ['ana@example.com'],
      expiryDate: new Date(Date.now() + 48 * 3600000).toISOString(), usedCount: 0, openedAt: null, windowEndsAt: null,
    },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/recovery-open', () => {
  it('abre o link, começa a janela e devolve o cupom sem expor a lista de e-mails', async () => {
    const res = await call({ link: recoveryLinkParam(code()) });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.coupon).toMatchObject({ code: code(), discountPercent: 15 });
    expect(res.body.coupon).not.toHaveProperty('targetEmails');
    expect(res.body.windowEndsAt).toBeGreaterThan(Date.now());
    expect(res.body.replay).toBe(false);
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'recovery-open', identity: 'uid1' }));
  });

  it('exige login', async () => {
    mocks.user = null;
    expect((await call({ link: recoveryLinkParam(code()) })).statusCode).toBe(401);
  });

  it('recusa chave adulterada, campos extras e dono diferente', async () => {
    expect((await call({ link: `${code()}.${'A'.repeat(32)}` })).body.error).toBe('invalid_recovery_link');
    expect((await call({ link: recoveryLinkParam(code()), extra: 1 })).statusCode).toBe(400);
    mocks.user = { uid: 'intruso', email: 'x@example.com', email_verified: true };
    const res = await call({ link: recoveryLinkParam(code()) });
    expect(res.statusCode).toBe(403);
    expect(mocks.docs[`coupons/${code()}`].openedAt).toBeNull();
  });

  it('a validação de cupom comum continua funcionando no mesmo endpoint (sem ?action)', async () => {
    const res = await call({ code: 'NAOEXISTE', orderTotalYen: 1000 }, {});
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('coupon_not_found');
  });
});
