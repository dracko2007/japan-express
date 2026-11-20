import { adminAuth } from './firebase-admin.js';
import { HttpError, normalizeEmail } from './http.js';
import { buildDashboardAnalytics, ORDER_FIELDS } from './order-analytics.js';
import { deleteCustomerAccount } from './customer-accounts.js';

/**
 * Comandos da CLI (`scripts/cli/je.mjs`). Cada um declara o escopo que exige:
 *  - `read`: só consulta;
 *  - `write`: altera dados de forma reversível (status, rastreio, estoque, cupom);
 *  - `destructive`: apaga. Além do escopo, exige `confirm: true` no pedido (a CLI manda com `--yes`).
 *
 * As escritas gravam os MESMOS campos que o painel grava (ver `orderService`, `couponService`), para o site
 * não perceber diferença entre uma alteração feita pela CLI e uma feita no painel.
 */

const ORDER_STATUSES = ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const SCAN_LIMIT = 3000; // máximo de documentos lidos por consulta; filtro e ordem acontecem aqui, sem índice novo
const SCAN_PAGE = 500;
const PRODUCT_FIELDS_SETTABLE = new Set([
  'hidden', 'discountPercent', 'stock', 'featured', 'isNew', 'noPsFee', 'freeShippingSolo', 'prices', 'cost',
]);

function bad(argument, reason) {
  return new HttpError(400, 'invalid_argument', `${argument}: ${reason}`, { argument, reason });
}

function text(args, name, { max = 200, required = true } = {}) {
  const value = args?.[name];
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(name, 'obrigatório');
    return '';
  }
  if (typeof value !== 'string') throw bad(name, 'deve ser texto');
  const trimmed = value.trim();
  if (!trimmed && required) throw bad(name, 'obrigatório');
  if (trimmed.length > max) throw bad(name, `no máximo ${max} caracteres`);
  return trimmed;
}

function whole(args, name, { min = 0, max = 1_000_000, fallback } = {}) {
  const value = args?.[name];
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw bad(name, 'obrigatório');
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(name, `inteiro entre ${min} e ${max}`);
  return n;
}

function limitArg(args, fallback = 20) {
  return whole(args, 'limit', { min: 1, max: 100, fallback });
}

/** Lê a coleção toda (em páginas de 500, ordenada pelo id ou por `orderField`) até SCAN_LIMIT; avisa se cortou. */
async function scanCollection(db, name, { orderField, direction = 'asc' } = {}) {
  const docs = [];
  let cursor = null;
  while (docs.length < SCAN_LIMIT) {
    let query = orderField ? db.collection(name).orderBy(orderField, direction) : db.collection(name).orderBy('__name__');
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.limit(Math.min(SCAN_PAGE, SCAN_LIMIT - docs.length)).get();
    docs.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    if (snap.size < SCAN_PAGE) return { docs, truncated: false };
    cursor = snap.docs[snap.docs.length - 1];
  }
  return { docs, truncated: true };
}

/** Recorta a página pedida e descreve o que sobrou: `total` (depois dos filtros), `offset`, `hasMore`. */
function paginate(list, args, truncated = false) {
  const limit = limitArg(args);
  const offset = whole(args, 'offset', { min: 0, max: 1_000_000, fallback: 0 });
  const page = list.slice(offset, offset + limit);
  return { page, meta: { count: page.length, total: list.length, offset, hasMore: offset + page.length < list.length, ...(truncated ? { truncated: true } : {}) } };
}

/** Timestamps do Firestore viram texto ISO, para a resposta ser JSON puro. */
export function plain(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

const pick = (data, fields) => Object.fromEntries(fields.filter((f) => data[f] !== undefined).map((f) => [f, plain(data[f])]));
const includes = (value, needle) => String(value ?? '').toLowerCase().includes(needle);

const mostRecentOrders = (db) => scanCollection(db, 'orders', { orderField: 'orderDate', direction: 'desc' });

const orderSummary = (o) => ({
  orderNumber: o.orderNumber || o.id,
  date: plain(o.orderDate || o.date),
  status: o.status || 'pending',
  customerName: o.customerName || o.shippingAddress?.name || '',
  customerEmail: o.customerEmail || '',
  currency: o.currency || 'JPY',
  total: o.totalPrice ?? o.totalAmount ?? o.total ?? null,
  totalYen: o.totalYen ?? o.grandTotalYen ?? null,
  paymentMethod: o.paymentMethod || '',
  paymentConfirmed: o.paymentConfirmed === true,
  trackingNumber: o.trackingNumber || '',
  items: Array.isArray(o.items) ? o.items.length : 0,
});

async function requireOrder(db, orderNumber) {
  const ref = db.collection('orders').doc(orderNumber);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'order_not_found');
  return { ref, data: snap.data() };
}

export const COMMANDS = {
  // ── leitura ──────────────────────────────────────────────────────────────────────────────────
  whoami: {
    scope: 'read',
    help: 'Mostra a chave em uso: nome, escopos e validade.',
    async run({ key }) {
      return { name: key.name, keyId: key.keyId, scopes: key.scopes, expiresAt: new Date(key.expiresAt).toISOString() };
    },
  },

  health: {
    scope: 'read',
    help: 'Confere o servidor e conta pedidos, clientes, produtos e cupons.',
    async run({ db }) {
      const count = async (name) => (await db.collection(name).count().get()).data().count;
      const [orders, users, coupons, catalog] = await Promise.all([
        count('orders'), count('users'), count('coupons'), db.collection('products').select('hidden', '__deleted').get(),
      ]);
      // `__deleted` é a lápide do apagar do painel: o documento continua no banco, mas não é produto.
      const rows = catalog.docs.map((d) => d.data());
      const deleted = rows.filter((p) => p.__deleted === true).length;
      const hidden = rows.filter((p) => p.__deleted !== true && p.hidden === true).length;
      const products = { active: rows.length - deleted - hidden, hidden, deleted, documents: rows.length };
      return { ok: true, orders, customers: users, products, coupons, at: new Date().toISOString() };
    },
  },

  stats: {
    scope: 'read',
    help: 'Resumo de vendas do painel (mesma conta do Dashboard).',
    async run({ db }) {
      const [orders, products, costs] = await Promise.all([
        db.collection('orders').select(...ORDER_FIELDS).get(),
        db.collection('products').select('name', 'cost').get(),
        db.collection('productCosts').select('cost').get(),
      ]);
      const costById = new Map(costs.docs.map((d) => [d.id, d.data().cost]));
      return plain(buildDashboardAnalytics(
        orders.docs.map((d) => ({ id: d.id, ...d.data() })),
        products.docs.map((d) => ({ id: d.id, ...d.data(), cost: costById.has(d.id) ? costById.get(d.id) : d.data().cost })),
      ));
    },
  },

  'orders.list': {
    scope: 'read',
    help: `Pedidos, do mais recente. Opções: status, search (nº, nome ou e-mail), limit (até 100), offset.`,
    async run({ db, args }) {
      const status = text(args, 'status', { required: false, max: 30 });
      const search = text(args, 'search', { required: false, max: 100 }).toLowerCase();
      const scan = await mostRecentOrders(db);
      let list = scan.docs;
      if (status) list = list.filter((o) => (o.status || 'pending') === status);
      if (search) {
        list = list.filter((o) => [o.orderNumber, o.id, o.customerName, o.customerEmail, o.shippingAddress?.name].some((v) => includes(v, search)));
      }
      const { page, meta } = paginate(list, args, scan.truncated);
      return { ...meta, orders: page.map(orderSummary) };
    },
  },

  'orders.get': {
    scope: 'read',
    help: 'Pedido completo. Argumento: orderNumber.',
    async run({ db, args }) {
      const { data } = await requireOrder(db, text(args, 'orderNumber', { max: 80 }));
      return plain(data);
    },
  },

  'customers.list': {
    scope: 'read',
    help: `Clientes. Opções: search (nome, e-mail ou telefone), limit (até 100), offset.`,
    async run({ db, args }) {
      const search = text(args, 'search', { required: false, max: 100 }).toLowerCase();
      const scan = await scanCollection(db, 'users');
      let list = scan.docs;
      if (search) list = list.filter((u) => [u.name, u.email, u.phone].some((v) => includes(v, search)));
      const { page, meta } = paginate(list, args, scan.truncated);
      return {
        ...meta,
        customers: page.map((u) => ({
          id: u.id, name: u.name, email: u.email, phone: u.phone || '', createdAt: plain(u.createdAt),
          points: u.points || 0, coupons: Array.isArray(u.coupons) ? u.coupons.length : 0,
        })),
      };
    },
  },

  'customers.get': {
    scope: 'read',
    help: 'Cliente completo + situação do login e pedidos. Argumento: email.',
    async run({ db, args }) {
      const email = normalizeEmail(text(args, 'email', { max: 254 }));
      const profiles = await db.collection('users').where('email', '==', email).limit(3).get();
      let login = null;
      try {
        const record = await adminAuth().getUserByEmail(email);
        login = { uid: record.uid, emailVerified: record.emailVerified, disabled: record.disabled, createdAt: record.metadata?.creationTime, lastSignIn: record.metadata?.lastSignInTime };
      } catch (error) {
        if (error?.code !== 'auth/user-not-found') throw error;
      }
      if (profiles.empty && !login) throw new HttpError(404, 'customer_not_found');
      const orders = await db.collection('orders').where('customerEmail', '==', email).limit(50).get();
      return { email, login, profiles: profiles.docs.map((d) => ({ id: d.id, ...plain(d.data()) })), orders: orders.docs.map((d) => orderSummary({ id: d.id, ...d.data() })) };
    },
  },

  'products.list': {
    scope: 'read',
    help: `Produtos. Opções: category, search (nome ou id), hidden (true/false), deleted (true: só os apagados), limit (até 100), offset. Apagados ficam de fora por padrão.`,
    async run({ db, args }) {
      const category = text(args, 'category', { required: false, max: 60 });
      const search = text(args, 'search', { required: false, max: 100 }).toLowerCase();
      const scan = await scanCollection(db, 'products');
      const onlyDeleted = args?.deleted === true || args?.deleted === 'true';
      let list = scan.docs.filter((p) => (p.__deleted === true) === onlyDeleted);
      if (category) list = list.filter((p) => p.category === category);
      if (search) list = list.filter((p) => includes(p.name, search) || includes(p.id, search));
      if (args?.hidden !== undefined) list = list.filter((p) => (p.hidden === true) === (args.hidden === true || args.hidden === 'true'));
      const { page, meta } = paginate(list, args, scan.truncated);
      return { ...meta, products: page.map((p) => pick(p, ['id', 'name', 'category', 'prices', 'discountPercent', 'hidden', 'stock', 'featured'])) };
    },
  },

  'products.get': {
    scope: 'read',
    help: 'Produto completo, com o custo. Argumento: id.',
    async run({ db, args }) {
      const id = text(args, 'id', { max: 160 });
      const [snap, cost] = await Promise.all([db.collection('products').doc(id).get(), db.collection('productCosts').doc(id).get()]);
      if (!snap.exists) throw new HttpError(404, 'product_not_found');
      return { id, ...plain(snap.data()), cost: cost.exists ? cost.data().cost : snap.data().cost ?? null };
    },
  },

  'coupons.list': {
    scope: 'read',
    help: 'Cupons globais cadastrados.',
    async run({ db }) {
      const snap = await db.collection('coupons').limit(SCAN_LIMIT).get();
      return { count: snap.size, coupons: snap.docs.map((d) => pick(d.data(), ['code', 'type', 'discount', 'discountPercent', 'expiryDate', 'isActive', 'usedCount', 'usageLimit', 'freeShipping', 'minOrderValue', 'targetType', 'description', 'recovery'])) };
    },
  },

  'audit.list': {
    scope: 'read',
    help: 'Registro dos últimos comandos executados por chaves de API. Opção: limit.',
    async run({ db, args }) {
      const snap = await db.collection('api_key_audit').orderBy('at', 'desc').limit(limitArg(args, 30)).get();
      return { entries: snap.docs.map((d) => ({ ...plain(d.data()), at: new Date(d.data().at).toISOString() })) };
    },
  },

  // ── escrita ──────────────────────────────────────────────────────────────────────────────────
  'orders.set-status': {
    scope: 'write',
    help: `Muda o status do pedido. Argumentos: orderNumber, status (${ORDER_STATUSES.join('|')}). Não confirma pagamento.`,
    async run({ db, args }) {
      const orderNumber = text(args, 'orderNumber', { max: 80 });
      const status = text(args, 'status', { max: 30 });
      if (!ORDER_STATUSES.includes(status)) throw bad('status', `use um de: ${ORDER_STATUSES.join(', ')}`);
      const { ref, data } = await requireOrder(db, orderNumber);
      await ref.update({ status, updatedAt: new Date().toISOString() });
      return { orderNumber, from: data.status || 'pending', to: status };
    },
  },

  'orders.set-tracking': {
    scope: 'write',
    help: 'Grava o rastreio e marca como enviado. Argumentos: orderNumber, trackingNumber, carrier, trackingUrl (opcional).',
    async run({ db, args }) {
      const orderNumber = text(args, 'orderNumber', { max: 80 });
      const trackingNumber = text(args, 'trackingNumber', { max: 80 });
      const carrier = text(args, 'carrier', { max: 80 });
      const trackingUrl = text(args, 'trackingUrl', { required: false, max: 500 });
      if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) throw bad('trackingUrl', 'precisa começar com https://');
      const { ref } = await requireOrder(db, orderNumber);
      await ref.update({ trackingNumber, trackingUrl, carrier, status: 'shipped', updatedAt: new Date().toISOString() });
      return { orderNumber, trackingNumber, carrier, status: 'shipped' };
    },
  },

  'products.update': {
    scope: 'write',
    help: `Altera campos de um produto. Argumentos: id, set (objeto). Campos aceitos: ${[...PRODUCT_FIELDS_SETTABLE].join(', ')}. O custo vai para productCosts.`,
    async run({ db, args }) {
      const id = text(args, 'id', { max: 160 });
      const set = args?.set;
      if (!set || typeof set !== 'object' || Array.isArray(set) || !Object.keys(set).length) throw bad('set', 'informe os campos a alterar');
      const unknown = Object.keys(set).filter((k) => !PRODUCT_FIELDS_SETTABLE.has(k));
      if (unknown.length) throw bad('set', `campo(s) não permitido(s): ${unknown.join(', ')}`);

      const update = {};
      for (const [field, value] of Object.entries(set)) {
        if (['hidden', 'featured', 'isNew', 'noPsFee', 'freeShippingSolo'].includes(field)) {
          if (typeof value !== 'boolean') throw bad(field, 'deve ser true ou false');
          update[field] = value;
        } else if (field === 'discountPercent') {
          update[field] = whole(set, field, { min: 0, max: 100 });
        } else if (field === 'stock') {
          if (!value || typeof value !== 'object' || typeof value.unlimited !== 'boolean') throw bad('stock', 'use { unlimited: true|false, quantity: n }');
          update.stock = { unlimited: value.unlimited, quantity: whole(value, 'quantity', { min: 0, max: 100_000, fallback: 0 }) };
        } else if (field === 'prices') {
          if (!value || typeof value !== 'object') throw bad('prices', 'use { small: ¥, large: ¥ }');
          for (const size of Object.keys(value)) {
            if (!['small', 'large'].includes(size)) throw bad('prices', 'só small e large');
            update[`prices.${size}`] = whole(value, size, { min: 1, max: 10_000_000 });
          }
        }
      }
      const snap = await db.collection('products').doc(id).get();
      if (!snap.exists) throw new HttpError(404, 'product_not_found');
      const now = new Date().toISOString();
      if (Object.keys(update).length) await db.collection('products').doc(id).update({ ...update, updatedAt: now });
      if (set.cost !== undefined) {
        await db.collection('productCosts').doc(id).set({ cost: whole(set, 'cost', { min: 0, max: 10_000_000 }), updatedAt: now });
      }
      return { id, changed: Object.keys(set) };
    },
  },

  'coupons.create': {
    scope: 'write',
    help: 'Cria um cupom global. Argumentos: code, type (percent|fixed), value, days (validade), description, usageLimit, minOrderValue, freeShipping.',
    async run({ db, args }) {
      const code = text(args, 'code', { max: 40 }).toUpperCase();
      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw bad('code', 'use letras, números, - ou _ (3 a 40)');
      const type = text(args, 'type', { max: 10 });
      if (!['percent', 'fixed'].includes(type)) throw bad('type', 'percent ou fixed');
      const value = whole(args, 'value', { min: 1, max: type === 'percent' ? 100 : 1_000_000 });
      const days = whole(args, 'days', { min: 1, max: 730, fallback: 30 });
      const ref = db.collection('coupons').doc(code);
      if ((await ref.get()).exists) throw new HttpError(409, 'coupon_exists');
      const now = new Date();
      const coupon = {
        code,
        type,
        discount: type === 'fixed' ? value : 0,
        discountPercent: type === 'percent' ? value : 0,
        description: text(args, 'description', { required: false, max: 200 }) || 'Cupom de desconto',
        expiryDate: new Date(now.getTime() + days * 86_400_000).toISOString(),
        isActive: true,
        targetType: 'all',
        freeShipping: args?.freeShipping === true,
        usedCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...(args?.usageLimit !== undefined ? { usageLimit: whole(args, 'usageLimit', { min: 1, max: 1_000_000 }) } : {}),
        ...(args?.minOrderValue !== undefined ? { minOrderValue: whole(args, 'minOrderValue', { min: 1, max: 10_000_000 }) } : {}),
      };
      await ref.set(coupon);
      return pick(coupon, ['code', 'type', 'discount', 'discountPercent', 'expiryDate', 'isActive']);
    },
  },

  'coupons.set-active': {
    scope: 'write',
    help: 'Ativa ou desativa um cupom. Argumentos: code, active (true|false).',
    async run({ db, args }) {
      const code = text(args, 'code', { max: 40 }).toUpperCase();
      if (typeof args?.active !== 'boolean') throw bad('active', 'true ou false');
      const ref = db.collection('coupons').doc(code);
      if (!(await ref.get()).exists) throw new HttpError(404, 'coupon_not_found');
      await ref.update({ isActive: args.active, updatedAt: new Date().toISOString() });
      return { code, isActive: args.active };
    },
  },

  // ── destrutivos (exigem confirm: true) ───────────────────────────────────────────────────────
  'customers.delete': {
    scope: 'destructive',
    help: 'Apaga o cliente: login, perfil, lista de desejos e carrinho salvo. Os pedidos ficam. Argumento: email.',
    async run({ args }) {
      return deleteCustomerAccount({ email: text(args, 'email', { max: 254 }) });
    },
  },

  'orders.delete': {
    scope: 'destructive',
    help: 'Apaga um pedido (registro financeiro: prefira cancelar). Argumento: orderNumber.',
    async run({ db, args }) {
      const orderNumber = text(args, 'orderNumber', { max: 80 });
      const { ref, data } = await requireOrder(db, orderNumber);
      await ref.delete();
      return { orderNumber, deleted: true, wasStatus: data.status || 'pending' };
    },
  },

  'coupons.delete': {
    scope: 'destructive',
    help: 'Apaga um cupom global. Argumento: code.',
    async run({ db, args }) {
      const code = text(args, 'code', { max: 40 }).toUpperCase();
      const ref = db.collection('coupons').doc(code);
      if (!(await ref.get()).exists) throw new HttpError(404, 'coupon_not_found');
      await ref.delete();
      return { code, deleted: true };
    },
  },
};

export const commandNames = () => Object.keys(COMMANDS);
