// CLI do site (`scripts/cli/je.mjs`): chave de API com acesso de administrador, sem sessão de navegador.
// Estes testes fixam as travas que protegem a loja se a chave vazar: hash, validade, revogação, escopos,
// confirmação de ação destrutiva, auditoria antes de escrever e limite de uso.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Firestore em memória (só o que o código usa) ────────────────────────────────────────────────
class FakeDb {
  constructor() { this.data = {}; this.seq = 0; this.failAuditWrites = false; }
  col(name) { return (this.data[name] ??= {}); }
  collection(name) { return new FakeCollection(this, name); }
  seed(name, id, doc) { this.col(name)[id] = structuredClone(doc); }
  get(name, id) { return this.data[name]?.[id]; }
}
const setPath = (obj, path, value) => {
  const parts = path.split('.');
  let cursor = obj;
  for (const part of parts.slice(0, -1)) cursor = (cursor[part] ??= {});
  cursor[parts.at(-1)] = value;
};
class FakeRef {
  constructor(db, name, id) { this.db = db; this.name = name; this.id = id; }
  async get() {
    const doc = this.db.col(this.name)[this.id];
    return { id: this.id, exists: doc !== undefined, data: () => structuredClone(doc), ref: this };
  }
  async set(value) {
    if (this.name === 'api_key_audit' && this.db.failAuditWrites) throw new Error('audit down');
    this.db.col(this.name)[this.id] = structuredClone(value);
  }
  async update(value) {
    const doc = this.db.col(this.name)[this.id];
    if (doc === undefined) throw new Error('not found');
    for (const [k, v] of Object.entries(value)) setPath(doc, k, v);
  }
  async delete() { delete this.db.col(this.name)[this.id]; }
}
class FakeQuery {
  constructor(db, name, filters = [], order = null, max = Infinity, after = null) { Object.assign(this, { db, name, filters, order, max, after }); }
  where(field, op, value) { return new FakeQuery(this.db, this.name, [...this.filters, [field, value]], this.order, this.max, this.after); }
  orderBy(field, dir = 'asc') { return new FakeQuery(this.db, this.name, this.filters, [field, dir], this.max, this.after); }
  limit(n) { return new FakeQuery(this.db, this.name, this.filters, this.order, n, this.after); }
  startAfter(snapshot) { return new FakeQuery(this.db, this.name, this.filters, this.order, this.max, snapshot.id); }
  select() { return this; }
  count() { return { get: async () => ({ data: () => ({ count: Object.keys(this.db.col(this.name)).length }) }) }; }
  async get() {
    let rows = Object.entries(this.db.col(this.name)).map(([id, doc]) => ({ id, doc }));
    for (const [field, value] of this.filters) rows = rows.filter((r) => r.doc[field] === value);
    if (this.order) {
      const [field, dir] = this.order;
      const key = (r) => (field === '__name__' ? r.id : String(r.doc[field] ?? ''));
      rows.sort((a, b) => (key(a) < key(b) ? -1 : 1) * (dir === 'desc' ? -1 : 1));
    }
    if (this.after) rows = rows.slice(rows.findIndex((r) => r.id === this.after) + 1);
    rows = rows.slice(0, this.max);
    const docs = rows.map(({ id, doc }) => ({ id, exists: true, data: () => structuredClone(doc), ref: new FakeRef(this.db, this.name, id) }));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}
class FakeCollection extends FakeQuery {
  constructor(db, name) { super(db, name); }
  doc(id) { return new FakeRef(this.db, this.name, id); }
  async add(value) {
    const id = `auto${++this.db.seq}`;
    const ref = new FakeRef(this.db, this.name, id);
    await ref.set(value);
    return ref;
  }
}

const mocks = vi.hoisted(() => ({
  db: null,
  auth: { getUserByEmail: vi.fn(), revokeRefreshTokens: vi.fn(), deleteUser: vi.fn() },
  limit: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('./firebase-admin.js', () => ({ adminDb: () => mocks.db, adminAuth: () => mocks.auth }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: mocks.limit }));
vi.mock('./auth.js', () => ({ requireAdmin: mocks.requireAdmin, superAdminEmail: () => 'dono@japanexpress-store.com' }));

const { HttpError } = await import('./http.js');
const { createApiKey, authenticateApiKey, listApiKeys, revokeApiKey, hashApiKey, redactArgs, KEY_PREFIX } = await import('./api-keys.js');
const { handleCli, handleApiKeys } = await import('../admin.js');

const req = (body, { key, method = 'POST', headers = {} } = {}) => ({
  method,
  headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
  socket: { remoteAddress: '10.0.0.1' },
});
const res = () => ({
  statusCode: 200, body: null, headers: {},
  status(c) { this.statusCode = c; return this; },
  setHeader(n, v) { this.headers[n] = v; return this; },
  json(v) { this.body = v; return this; },
  end() { return this; },
});
const call = async (handler, request) => { const r = res(); await handler(request, r); return r; };
const run = (key, command, args, extra = {}) => call(handleCli, req({ command, ...(args ? { args } : {}), ...extra }, { key }));

const ORDER = { orderNumber: 'JE-1', orderDate: '2026-11-19T10:00:00Z', status: 'pending', customerEmail: 'ana@exemplo.com', customerName: 'Ana', totalYen: 5000, items: [{}, {}] };

let keys;
async function newKey(scopes, extra = {}) {
  return createApiKey({ name: 'teste', scopes, days: 30, createdBy: 'dono', ...extra });
}

beforeEach(() => {
  mocks.db = new FakeDb();
  mocks.limit.mockReset().mockResolvedValue(undefined);
  mocks.requireAdmin.mockReset().mockResolvedValue({ uid: 'admin_dono', email: 'dono@japanexpress-store.com', adminRole: 3 });
  Object.values(mocks.auth).forEach((f) => f.mockReset());
  mocks.auth.revokeRefreshTokens.mockResolvedValue(undefined);
  mocks.auth.deleteUser.mockResolvedValue(undefined);
  mocks.db.seed('orders', 'JE-1', ORDER);
  mocks.db.seed('orders', 'JE-2', { ...ORDER, orderNumber: 'JE-2', orderDate: '2026-11-18T10:00:00Z', status: 'shipped', customerName: 'Bruno', customerEmail: 'bruno@exemplo.com' });
  mocks.db.seed('products', 'p1', { name: 'Máscara Fino', category: 'cosmeticos', prices: { small: 1650, large: 3000 }, stock: { unlimited: true, quantity: 0 }, hidden: false });
  keys = {};
});

describe('chave de API', () => {
  it('só o hash é guardado; o texto da chave nunca fica no banco', async () => {
    const { key } = await newKey(['read']);
    expect(key.startsWith(KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThan(40);
    const stored = JSON.stringify(mocks.db.data.api_keys);
    expect(stored).not.toContain(key);
    expect(Object.keys(mocks.db.data.api_keys)).toEqual([hashApiKey(key)]);
  });

  it('autentica a chave válida e devolve nome e escopos', async () => {
    const { key } = await newKey(['read', 'write']);
    const auth = await authenticateApiKey(req(undefined, { key }));
    expect(auth.scopes).toEqual(['read', 'write']);
    expect(auth.name).toBe('teste');
  });

  it('chave inexistente, mal formada, expirada ou revogada: sempre o mesmo 401', async () => {
    const valida = await newKey(['read']);
    const expirada = await newKey(['read'], { now: Date.now() - 40 * 86_400_000 }); // criada há 40 dias, vale 30
    const revogada = await newKey(['read']);
    await revokeApiKey(revogada.id);

    for (const key of [undefined, 'lixo', `${KEY_PREFIX}${'x'.repeat(43)}`, expirada.key, revogada.key]) {
      await expect(authenticateApiKey(req(undefined, { key }))).rejects.toMatchObject({ statusCode: 401, code: 'unauthorized' });
    }
    await expect(authenticateApiKey(req(undefined, { key: valida.key }))).resolves.toBeTruthy();
  });

  it('a listagem não revela a chave nem o hash', async () => {
    const { key } = await newKey(['read']);
    const lista = await listApiKeys();
    const texto = JSON.stringify(lista);
    expect(texto).not.toContain(key);
    expect(texto).not.toContain(hashApiKey(key));
    expect(lista[0].preview.startsWith(KEY_PREFIX)).toBe(true);
  });

  it('validade padrão 90 dias, máximo 365; escopo inválido e nome vazio são recusados', async () => {
    const padrao = await createApiKey({ name: 'a', scopes: ['read'], createdBy: 'x', now: 1_000 });
    expect(padrao.expiresAt).toBe(1_000 + 90 * 86_400_000);
    await expect(createApiKey({ name: 'a', scopes: ['read'], days: 400 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(createApiKey({ name: 'a', scopes: ['root'] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(createApiKey({ name: '  ', scopes: ['read'] })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('revogar é imediato e repetir é inofensivo', async () => {
    const { key, id } = await newKey(['read']);
    await revokeApiKey(id);
    await revokeApiKey(id);
    await expect(authenticateApiKey(req(undefined, { key }))).rejects.toMatchObject({ statusCode: 401 });
    await expect(revokeApiKey('inexistente')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('o registro de auditoria nunca guarda segredo', () => {
    const r = redactArgs({ email: 'a@b.com', password: 'abc', apiKey: 'je_live_x', nested: { token: 't', ok: 1 }, longo: 'x'.repeat(500) });
    expect(r.password).toBe('[omitido]');
    expect(r.apiKey).toBe('[omitido]');
    expect(r.nested.token).toBe('[omitido]');
    expect(r.nested.ok).toBe(1);
    expect(r.longo.length).toBeLessThan(300);
    expect(r.email).toBe('a@b.com');
  });
});

describe('endpoint da CLI: travas', () => {
  it('sem chave ou com chave errada: 401, e nada é executado', async () => {
    expect((await call(handleCli, req({ command: 'health' }))).statusCode).toBe(401);
    expect((await run('je_live_errada', 'health')).statusCode).toBe(401);
  });

  it('o limite de uso é aplicado por endereço (antes de autenticar) e por chave', async () => {
    const { key } = await newKey(['read']);
    await run(key, 'whoami');
    const escopos = mocks.limit.mock.calls.map(([, o]) => o.scope);
    expect(escopos).toEqual(['cli:ip', 'cli:key']);
    mocks.limit.mockRejectedValue(new HttpError(429, 'rate_limited'));
    expect((await run(key, 'whoami')).statusCode).toBe(429);
  });

  it('comando desconhecido: 404 com a lista dos que existem', async () => {
    const { key } = await newKey(['read']);
    const r = await run(key, 'orders.explodir');
    expect(r.statusCode).toBe(404);
    expect(r.body.commands).toContain('orders.list');
  });

  it('não deixa chamar propriedades do objeto (constructor, __proto__...) como se fossem comandos', async () => {
    const { key } = await newKey(['read']);
    for (const command of ['constructor', '__proto__', 'toString']) expect((await run(key, command)).statusCode).toBe(404);
  });

  it('chave só de leitura não escreve nem apaga', async () => {
    const { key } = await newKey(['read']);
    const w = await run(key, 'orders.set-status', { orderNumber: 'JE-1', status: 'shipped' });
    expect(w.statusCode).toBe(403);
    expect(w.body.required).toBe('write');
    expect(mocks.db.get('orders', 'JE-1').status).toBe('pending');
    expect((await run(key, 'orders.delete', { orderNumber: 'JE-1' }, { confirm: true })).statusCode).toBe(403);
    expect(mocks.db.get('orders', 'JE-1')).toBeTruthy();
  });

  it('ação destrutiva sem confirmação: 409 e nada é apagado', async () => {
    const { key } = await newKey(['read', 'write', 'destructive']);
    const r = await run(key, 'orders.delete', { orderNumber: 'JE-1' });
    expect(r.statusCode).toBe(409);
    expect(r.body.error).toBe('confirmation_required');
    expect(mocks.db.get('orders', 'JE-1')).toBeTruthy();

    const ok = await run(key, 'orders.delete', { orderNumber: 'JE-1' }, { confirm: true });
    expect(ok.statusCode).toBe(200);
    expect(mocks.db.get('orders', 'JE-1')).toBeUndefined();
  });

  it('chave sem o escopo destructive não apaga nem com confirmação', async () => {
    const { key } = await newKey(['read', 'write']);
    expect((await run(key, 'coupons.delete', { code: 'X' }, { confirm: true })).statusCode).toBe(403);
  });

  it('campos extras no corpo são recusados', async () => {
    const { key } = await newKey(['read']);
    expect((await call(handleCli, req({ command: 'health', sudo: true }, { key }))).statusCode).toBe(400);
  });

  it('cada comando fica registrado: início antes de executar, resultado depois', async () => {
    const { key } = await newKey(['read', 'write']);
    await run(key, 'orders.set-status', { orderNumber: 'JE-1', status: 'shipped', senha: 'segredo' });
    const entradas = Object.values(mocks.db.data.api_key_audit);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({ command: 'orders.set-status', ok: true, status: 'ok', name: 'teste' });
    expect(entradas[0].args.senha).toBe('[omitido]');
  });

  it('comando que falha é registrado como falha', async () => {
    const { key } = await newKey(['read', 'write']);
    const r = await run(key, 'orders.set-status', { orderNumber: 'NAO-EXISTE', status: 'shipped' });
    expect(r.statusCode).toBe(404);
    expect(Object.values(mocks.db.data.api_key_audit)[0]).toMatchObject({ ok: false, status: 'order_not_found' });
  });

  it('sem poder registrar, NENHUMA escrita roda (leitura segue)', async () => {
    const { key } = await newKey(['read', 'write']);
    mocks.db.failAuditWrites = true;
    const w = await run(key, 'orders.set-status', { orderNumber: 'JE-1', status: 'shipped' });
    expect(w.statusCode).toBe(503);
    expect(mocks.db.get('orders', 'JE-1').status).toBe('pending');
    expect((await run(key, 'orders.get', { orderNumber: 'JE-1' })).statusCode).toBe(200);
  });
});

describe('comandos de leitura', () => {
  let key;
  beforeEach(async () => { key = (await newKey(['read'])).key; });

  it('whoami e health', async () => {
    expect((await run(key, 'whoami')).body.result.scopes).toEqual(['read']);
    const h = (await run(key, 'health')).body.result;
    expect(h).toMatchObject({ ok: true, orders: 2, products: { active: 1, hidden: 0, deleted: 0, documents: 1 } });
  });

  it('orders.list: mais recentes primeiro, filtro por status, busca e limite', async () => {
    const todos = (await run(key, 'orders.list')).body.result;
    expect(todos.orders.map((o) => o.orderNumber)).toEqual(['JE-1', 'JE-2']);
    expect((await run(key, 'orders.list', { status: 'shipped' })).body.result.orders.map((o) => o.orderNumber)).toEqual(['JE-2']);
    expect((await run(key, 'orders.list', { search: 'ana' })).body.result.orders.map((o) => o.orderNumber)).toEqual(['JE-1']);
    expect((await run(key, 'orders.list', { limit: 1 })).body.result.orders).toHaveLength(1);
    expect((await run(key, 'orders.list', { limit: 5000 })).statusCode).toBe(400);
  });

  it('orders.get devolve o pedido; inexistente é 404', async () => {
    expect((await run(key, 'orders.get', { orderNumber: 'JE-1' })).body.result.customerEmail).toBe('ana@exemplo.com');
    expect((await run(key, 'orders.get', { orderNumber: 'X' })).statusCode).toBe(404);
    expect((await run(key, 'orders.get', {})).body.argument).toBe('orderNumber');
  });

  it('listas paginam: offset, total, hasMore, e leem além de 500 documentos', async () => {
    for (let i = 0; i < 1100; i += 1) mocks.db.col('products')[`bulk-${String(i).padStart(4, '0')}`] = { name: `Bulk ${i}`, category: 'doces' };
    const first = (await run(key, 'products.list', { category: 'doces', limit: 100 })).body.result;
    expect(first).toMatchObject({ count: 100, total: 1100, offset: 0, hasMore: true });
    const last = (await run(key, 'products.list', { category: 'doces', limit: 100, offset: 1050 })).body.result;
    expect(last).toMatchObject({ count: 50, total: 1100, offset: 1050, hasMore: false });
    expect(last.products.at(-1).id).toBe('bulk-1099');
    const ids = new Set();
    for (let offset = 0; offset < 1100; offset += 100) (await run(key, 'products.list', { category: 'doces', limit: 100, offset })).body.result.products.forEach((p) => ids.add(p.id));
    expect(ids.size).toBe(1100); // sem repetir nem pular
    expect((await run(key, 'products.list', { offset: -1 })).statusCode).toBe(400);
  });

  it('products: health separa ativos, ocultos e apagados; a listagem esconde os apagados', async () => {
    const { key } = await newKey(['read']);
    Object.assign(mocks.db.col('products'), {
      oculto: { name: 'Oculto', hidden: true },
      lapide: { name: 'Apagado', __deleted: true },
      lapideOculta: { name: 'Apagado e oculto', hidden: true, __deleted: true },
    });
    const total = Object.keys(mocks.db.col('products')).length;
    const { products } = (await run(key, 'health')).body.result;
    expect(products).toEqual({ active: total - 3, hidden: 1, deleted: 2, documents: total });
    const ids = (await run(key, 'products.list')).body.result.products.map((p) => p.id);
    expect(ids).not.toContain('lapide');
    expect((await run(key, 'products.list', { deleted: true })).body.result.products.map((p) => p.id).sort()).toEqual(['lapide', 'lapideOculta']);
  });

  it('products.list e products.get (com o custo vindo de productCosts)', async () => {
    mocks.db.seed('productCosts', 'p1', { cost: 700 });
    expect((await run(key, 'products.list', { search: 'fino' })).body.result.products[0].id).toBe('p1');
    expect((await run(key, 'products.get', { id: 'p1' })).body.result.cost).toBe(700);
  });
});

describe('comandos de escrita', () => {
  let key;
  beforeEach(async () => { key = (await newKey(['read', 'write', 'destructive'])).key; });

  it('orders.set-status: valida o status e grava como o painel (status + updatedAt)', async () => {
    expect((await run(key, 'orders.set-status', { orderNumber: 'JE-1', status: 'voando' })).statusCode).toBe(400);
    const r = await run(key, 'orders.set-status', { orderNumber: 'JE-1', status: 'processing' });
    expect(r.body.result).toEqual({ orderNumber: 'JE-1', from: 'pending', to: 'processing' });
    expect(mocks.db.get('orders', 'JE-1')).toMatchObject({ status: 'processing' });
    expect(mocks.db.get('orders', 'JE-1').updatedAt).toBeTruthy();
  });

  it('orders.set-tracking: marca como enviado e só aceita link https', async () => {
    expect((await run(key, 'orders.set-tracking', { orderNumber: 'JE-1', trackingNumber: 'AB1', carrier: 'Yamato', trackingUrl: 'http://x.com' })).statusCode).toBe(400);
    const r = await run(key, 'orders.set-tracking', { orderNumber: 'JE-1', trackingNumber: 'AB1', carrier: 'Yamato', trackingUrl: 'https://toi.kuronekoyamato.co.jp/x' });
    expect(r.statusCode).toBe(200);
    expect(mocks.db.get('orders', 'JE-1')).toMatchObject({ status: 'shipped', trackingNumber: 'AB1', carrier: 'Yamato' });
  });

  it('products.update: só campos permitidos, com limites; o custo vai para productCosts', async () => {
    expect((await run(key, 'products.update', { id: 'p1', set: { name: 'Hack' } })).statusCode).toBe(400);
    expect((await run(key, 'products.update', { id: 'p1', set: { discountPercent: 150 } })).statusCode).toBe(400);
    expect((await run(key, 'products.update', { id: 'p1', set: { hidden: 'sim' } })).statusCode).toBe(400);
    expect((await run(key, 'products.update', { id: 'p1', set: {} })).statusCode).toBe(400);

    const r = await run(key, 'products.update', { id: 'p1', set: { discountPercent: 10, hidden: true, stock: { unlimited: false, quantity: 7 }, prices: { small: 1500 }, cost: 600 } });
    expect(r.statusCode).toBe(200);
    expect(mocks.db.get('products', 'p1')).toMatchObject({ discountPercent: 10, hidden: true, stock: { unlimited: false, quantity: 7 } });
    expect(mocks.db.get('products', 'p1').prices).toEqual({ small: 1500, large: 3000 }); // só o tamanho informado muda
    expect(mocks.db.get('products', 'p1').cost).toBeUndefined();                        // custo NÃO fica no produto (leitura pública)
    expect(mocks.db.get('productCosts', 'p1').cost).toBe(600);
    expect((await run(key, 'products.update', { id: 'nao-existe', set: { hidden: true } })).statusCode).toBe(404);
  });

  it('coupons.create / set-active / delete', async () => {
    expect((await run(key, 'coupons.create', { code: 'ab', type: 'percent', value: 10 })).statusCode).toBe(400);
    expect((await run(key, 'coupons.create', { code: 'NATAL10', type: 'percent', value: 150 })).statusCode).toBe(400);
    const c = await run(key, 'coupons.create', { code: 'natal10', type: 'percent', value: 10, days: 15, description: 'Natal' });
    expect(c.statusCode).toBe(200);
    expect(mocks.db.get('coupons', 'NATAL10')).toMatchObject({ code: 'NATAL10', type: 'percent', discountPercent: 10, discount: 0, isActive: true, usedCount: 0, targetType: 'all' });
    expect((await run(key, 'coupons.create', { code: 'NATAL10', type: 'percent', value: 10 })).statusCode).toBe(409);

    await run(key, 'coupons.set-active', { code: 'NATAL10', active: false });
    expect(mocks.db.get('coupons', 'NATAL10').isActive).toBe(false);
    expect((await run(key, 'coupons.set-active', { code: 'NATAL10', active: 'talvez' })).statusCode).toBe(400);

    expect((await run(key, 'coupons.delete', { code: 'NATAL10' })).statusCode).toBe(409); // sem --yes
    expect((await run(key, 'coupons.delete', { code: 'NATAL10' }, { confirm: true })).statusCode).toBe(200);
    expect(mocks.db.get('coupons', 'NATAL10')).toBeUndefined();
  });

  it('customers.delete apaga login, perfil, lista de desejos e carrinho; os pedidos ficam', async () => {
    mocks.auth.getUserByEmail.mockResolvedValue({ uid: 'u1', email: 'ana@exemplo.com' });
    mocks.db.seed('users', 'perfil1', { email: 'ana@exemplo.com', name: 'Ana' });
    mocks.db.seed('wishlists', 'perfil1', { items: [] });
    mocks.db.seed('carts', 'u1', { items: [] });

    expect((await run(key, 'customers.delete', { email: 'ana@exemplo.com' })).statusCode).toBe(409);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();

    const r = await run(key, 'customers.delete', { email: 'Ana@Exemplo.com' }, { confirm: true });
    expect(r.body.result).toEqual({ email: 'ana@exemplo.com', loginDeleted: true, profilesDeleted: 1 });
    expect(mocks.auth.deleteUser).toHaveBeenCalledWith('u1');
    expect(mocks.db.get('users', 'perfil1')).toBeUndefined();
    expect(mocks.db.get('wishlists', 'perfil1')).toBeUndefined();
    expect(mocks.db.get('carts', 'u1')).toBeUndefined();
    expect(mocks.db.get('orders', 'JE-1')).toBeTruthy();
  });

  it('customers.delete mantém as recusas: administrador e super administrador', async () => {
    mocks.auth.getUserByEmail.mockResolvedValue({ uid: 'admin_maria', email: 'maria@x.com' });
    expect((await run(key, 'customers.delete', { email: 'maria@x.com' }, { confirm: true })).statusCode).toBe(403);
    expect((await run(key, 'customers.delete', { email: 'dono@japanexpress-store.com' }, { confirm: true })).statusCode).toBe(403);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });
});

describe('gestão das chaves (painel, só gerente)', () => {
  const painel = (method, body) => call(handleApiKeys, req(body, { method, headers: { authorization: 'Bearer token-do-painel', origin: 'https://japanexpress-store.com' } }));

  it('gerente cria a chave e vê o texto uma única vez; a listagem não o mostra', async () => {
    const criada = await painel('POST', { name: 'Claude', scopes: ['read', 'write'], days: 30 });
    expect(criada.statusCode).toBe(201);
    expect(criada.body.key.startsWith(KEY_PREFIX)).toBe(true);
    const lista = await painel('GET');
    expect(JSON.stringify(lista.body)).not.toContain(criada.body.key);
    expect(lista.body.keys[0]).toMatchObject({ name: 'Claude', scopes: ['read', 'write'], createdBy: 'dono@japanexpress-store.com' });
    // e a chave criada funciona de verdade
    expect((await run(criada.body.key, 'whoami')).statusCode).toBe(200);
  });

  it('revogar pelo painel derruba a chave na hora', async () => {
    const criada = await painel('POST', { name: 'Claude', scopes: ['read'], days: 30 });
    await painel('DELETE', { id: criada.body.id });
    expect((await run(criada.body.key, 'whoami')).statusCode).toBe(401);
  });

  it('administrador que não é gerente não cria chave', async () => {
    mocks.requireAdmin.mockResolvedValue({ uid: 'admin_maria', email: 'maria@x.com', adminRole: 1 });
    mocks.db.seed('admins', 'admin_maria', { active: true, role: 1 });
    expect((await painel('POST', { name: 'x', scopes: ['read'], days: 30 })).statusCode).toBe(403);
    expect(mocks.db.data.api_keys).toBeUndefined();
  });

  it('a CLI NÃO consegue criar chaves: o endpoint de gestão exige sessão do painel', async () => {
    const { key } = await newKey(['read', 'write', 'destructive']);
    mocks.requireAdmin.mockRejectedValue(new HttpError(401, 'unauthorized'));
    const r = await call(handleApiKeys, req({ name: 'outra', scopes: ['read'], days: 30 }, { key }));
    expect(r.statusCode).toBe(401);
  });
});
