import { beforeEach, describe, expect, it, vi } from 'vitest';

// Visitas com local/aparelho, cadastros pelo link e compradores com/sem cadastro.
const mocks = vi.hoisted(() => ({ limit: vi.fn(), user: null, admin: true, docs: {} }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({
  requireUser: async () => mocks.user,
  requireAdmin: async () => {
    if (!mocks.admin) { const { HttpError } = await import('./http.js'); throw new HttpError(403, 'forbidden'); }
    return mocks.user;
  },
}));
vi.mock('./firebase-admin.js', () => ({
  adminDb: () => {
    const ref = (path) => ({ path });
    const read = async ({ path }) => ({ exists: path in mocks.docs, data: () => structuredClone(mocks.docs[path]) });
    const collection = (name) => ({
      doc: (id) => ref(`${name}/${id}`),
      where: (field, _op, value) => ({
        get: async () => ({
          docs: Object.entries(mocks.docs)
            .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
            .map(([path, data]) => ({ id: path.split('/')[1], data: () => structuredClone(data) })),
        }),
      }),
      get: async () => ({
        docs: Object.entries(mocks.docs).filter(([path]) => path.startsWith(`${name}/`)).map(([path, data]) => ({ id: path.split('/')[1], data: () => structuredClone(data) })),
      }),
    });
    return {
      collection,
      runTransaction: async (work) => work({
        get: read,
        set: ({ path }, data) => { mocks.docs[path] = data; },
        update: ({ path }, data) => { mocks.docs[path] = { ...mocks.docs[path], ...data }; },
      }),
    };
  },
}));

const { default: handler, summarizeBuyers } = await import('../affiliates.js');

async function call(body, headers = {}) {
  const res = { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, end() { return this; } };
  await handler({ method: 'POST', headers, body }, res);
  return res;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const AUTH = { authorization: 'Bearer token' };

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.user = null;
  mocks.admin = true;
  mocks.docs = {
    'affiliates/AMIGA10': { kind: 'affiliate', active: true, ownerEmail: 'dona@example.com' },
    'affiliates/VIDEO1': { kind: 'promoter', active: true, ownerEmail: 'dona@example.com' },
    'affiliates/OUTRA': { kind: 'affiliate', active: true, ownerEmail: 'outra@example.com' },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('visita: de onde e com que aparelho', () => {
  it('guarda país, estado, cidade e aparelho na visita e nos totais do código, sem IP', async () => {
    const geo = { 'x-vercel-ip-country': 'BR', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-forwarded-for': '203.0.113.9' };
    await call({ action: 'track-visit', code: 'AMIGA10', source: 'link', visitorId: 'visitante-aaa' }, { ...geo, 'user-agent': IPHONE });
    await call({ action: 'track-visit', code: 'AMIGA10', source: 'code', visitorId: 'visitante-bbb' }, { ...geo, 'user-agent': WINDOWS });
    await call({ action: 'track-visit', code: 'AMIGA10', source: 'link', visitorId: 'visitante-ccc' }, { 'x-vercel-ip-country': 'JP', 'user-agent': IPHONE });

    expect(mocks.docs['affiliates/AMIGA10'].visitStats).toEqual({
      countries: { BR: 2, JP: 1 },
      regions: { 'BR-SP': 2 },
      cities: { 'São Paulo': 2 },
      devices: { mobile: 2, desktop: 1 },
      os: { iOS: 2, Windows: 1 },
    });
    expect(mocks.docs['affiliate_visits/AMIGA10__v_visitante-aaa']).toMatchObject({ country: 'BR', region: 'SP', city: 'São Paulo', device: 'mobile', os: 'iOS' });
    expect(JSON.stringify(mocks.docs)).not.toContain('203.0.113.9');
  });
});

describe('cadastro pelo link ou código', () => {
  it('conta uma vez por conta e por código; não conta o dono nem código inativo', async () => {
    mocks.user = { uid: 'u1', email: 'cliente@example.com' };
    expect((await call({ action: 'track-signup', code: 'amiga10' }, AUTH)).body).toEqual({ counted: true });
    expect((await call({ action: 'track-signup', code: 'AMIGA10' }, AUTH)).body).toEqual({ counted: false });
    mocks.user = { uid: 'u2', email: 'outro@example.com' };
    expect((await call({ action: 'track-signup', code: 'AMIGA10' }, AUTH)).body).toEqual({ counted: true });
    expect(mocks.docs['affiliates/AMIGA10'].signupCount).toBe(2);

    mocks.user = { uid: 'dono', email: 'Dona@example.com' };
    expect((await call({ action: 'track-signup', code: 'AMIGA10' }, AUTH)).body).toEqual({ counted: false });
    mocks.docs['affiliates/OFF'] = { active: false, ownerEmail: 'x@example.com' };
    mocks.user = { uid: 'u3', email: 'c@example.com' };
    expect((await call({ action: 'track-signup', code: 'OFF' }, AUTH)).body).toEqual({ counted: false });
    expect((await call({ action: 'track-signup', code: 'NOPE' }, AUTH)).body).toEqual({ counted: false });
  });

  it('exige login e recusa campos extras', async () => {
    mocks.user = { uid: 'u1', email: 'cliente@example.com' };
    expect((await call({ action: 'track-signup', code: 'AMIGA10', uid: 'x' }, AUTH)).statusCode).toBe(400);
  });
});

describe('compradores: com cadastro e sem cadastro', () => {
  const paid = (extra) => ({ paymentConfirmed: true, status: 'confirmed', ...extra });

  it('conta pessoas distintas, separa convidado de cadastrado e ignora cancelado e não pago', () => {
    const summary = summarizeBuyers([
      paid({ userId: 'u1', customerType: 'registered', customerEmail: 'a@example.com' }),
      paid({ userId: 'u1', customerType: 'registered', customerEmail: 'a@example.com' }), // mesma pessoa, 2º pedido
      paid({ userId: 'u2', customerType: 'registered' }),
      paid({ userId: 'guest_abc', customerType: 'guest', customerEmail: 'g@example.com' }),
      paid({ userId: 'guest_def', customerEmail: 'g@example.com' }), // mesmo e-mail de convidado, pedido antigo
      { userId: 'u3', paymentConfirmed: false, status: 'pending_payment' },
      paid({ userId: 'u4', customerType: 'registered', status: 'cancelled' }),
    ]);
    expect(summary).toEqual({ total: 3, registered: 2, guest: 1, orders: 5 });
  });
});

describe('estatísticas por código', () => {
  beforeEach(() => {
    mocks.docs['affiliates/AMIGA10'] = {
      kind: 'affiliate', active: true, ownerEmail: 'dona@example.com', visitCount: 10, linkVisits: 7, codeVisits: 3, signupCount: 4,
      visitStats: { countries: { BR: 8, JP: 2 }, regions: { 'BR-SP': 5 }, cities: { 'São Paulo': 5 }, devices: { mobile: 8, desktop: 2 }, os: { iOS: 5, Android: 3, Windows: 2 } },
    };
    mocks.docs['orders/O1'] = { affiliateCode: 'AMIGA10', paymentConfirmed: true, status: 'confirmed', userId: 'u1', customerType: 'registered' };
    mocks.docs['orders/O2'] = { affiliateCode: 'AMIGA10', paymentConfirmed: true, status: 'confirmed', userId: 'guest_x', customerType: 'guest', customerEmail: 'g@example.com' };
    mocks.docs['orders/O3'] = { affiliateCode: 'OUTRA', paymentConfirmed: true, status: 'confirmed', userId: 'u9', customerType: 'registered' };
  });

  it('o parceiro vê só os próprios códigos, sem cidade', async () => {
    mocks.user = { uid: 'dona', email: 'dona@example.com' };
    const { body } = await call({ action: 'code-stats' }, AUTH);
    expect(Object.keys(body.codes).sort()).toEqual(['AMIGA10', 'VIDEO1']);
    expect(body.codes.AMIGA10).toMatchObject({
      visits: 10, linkVisits: 7, codeVisits: 3, signups: 4,
      buyers: { total: 2, registered: 1, guest: 1, orders: 2 },
      countries: { BR: 8, JP: 2 }, regions: { 'BR-SP': 5 }, devices: { mobile: 8, desktop: 2 }, cities: {},
    });
    expect(body.totals.buyers.total).toBe(2);
    expect(body.codes.OUTRA).toBeUndefined();
  });

  it('o admin vê todos os códigos, com cidade e totais somados', async () => {
    mocks.user = { uid: 'adm', email: 'admin@example.com' };
    const { body } = await call({ action: 'code-stats', admin: true }, AUTH);
    expect(Object.keys(body.codes).sort()).toEqual(['AMIGA10', 'OUTRA', 'VIDEO1']);
    expect(body.codes.AMIGA10.cities).toEqual({ 'São Paulo': 5 });
    expect(body.totals).toMatchObject({ visits: 10, signups: 4, buyers: { total: 3, registered: 2, guest: 1, orders: 3 }, devices: { mobile: 8, desktop: 2 } });
  });

  it('quem não é admin não consegue pedir a visão do admin', async () => {
    mocks.user = { uid: 'dona', email: 'dona@example.com' };
    mocks.admin = false;
    expect((await call({ action: 'code-stats', admin: true }, AUTH)).statusCode).toBe(403);
  });
});
