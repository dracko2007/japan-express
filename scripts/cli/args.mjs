// Interpretação da linha de comando da CLI do site (`je`). Puro: não toca em rede nem em arquivo,
// para poder ser testado. O `je.mjs` só envia o resultado deste módulo ao servidor.

/** Argumentos posicionais de cada comando, na ordem. */
const POSITIONALS = {
  'orders.get': ['orderNumber'],
  'orders.set-status': ['orderNumber', 'status'],
  'orders.set-tracking': ['orderNumber'],
  'orders.delete': ['orderNumber'],
  'customers.get': ['email'],
  'customers.delete': ['email'],
  'products.get': ['id'],
  'products.update': ['id'],
  'coupons.create': ['code'],
  'coupons.set-active': ['code', 'active'],
  'coupons.delete': ['code'],
};

/** Apelidos de opção por comando (o nome que se digita → o nome que o servidor espera). */
const ALIASES = {
  'orders.set-tracking': { number: 'trackingNumber', url: 'trackingUrl' },
  'coupons.create': { 'usage-limit': 'usageLimit', 'min-order': 'minOrderValue', 'free-shipping': 'freeShipping' },
};

const NUMBERS = new Set(['limit', 'offset', 'value', 'days', 'usageLimit', 'minOrderValue']);
const BOOLEANS = new Set(['hidden', 'deleted', 'freeShipping', 'active']);

/** Opções de `products.update` que viram campos de `set` (o que muda no produto). */
const PRODUCT_SET = {
  discount: ['discountPercent', 'number'],
  hidden: ['hidden', 'boolean'],
  featured: ['featured', 'boolean'],
  new: ['isNew', 'boolean'],
  'no-ps-fee': ['noPsFee', 'boolean'],
  'free-shipping-solo': ['freeShippingSolo', 'boolean'],
  cost: ['cost', 'number'],
};

/** Comandos de uma palavra só, e o comando do servidor a que correspondem. */
const SINGLE = { health: 'health', whoami: 'whoami', stats: 'stats', audit: 'audit.list' };
const GROUPS = new Set(['orders', 'customers', 'products', 'coupons']);
const DESTRUCTIVE = new Set(['customers.delete', 'orders.delete', 'coupons.delete']);

export class UsageError extends Error {}

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function cast(name, raw) {
  if (NUMBERS.has(name)) {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) throw new UsageError(`--${name} precisa ser um número (recebi "${raw}")`);
    return n;
  }
  if (BOOLEANS.has(name)) {
    if (raw === true || raw === 'true') return true;
    if (raw === 'false') return false;
    throw new UsageError(`${name} precisa ser true ou false (recebi "${raw}")`);
  }
  return raw;
}

function castBool(label, raw) {
  if (raw === true || raw === 'true') return true;
  if (raw === 'false') return false;
  throw new UsageError(`--${label} precisa ser true ou false (recebi "${raw}")`);
}

/** Separa `--opção valor`, `--opção=valor` e chaves sozinhas (`--yes`) dos argumentos posicionais. */
export function tokenize(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) { positional.push(token); continue; }
    const body = token.slice(2);
    if (!body) throw new UsageError('opção vazia (--)');
    const eq = body.indexOf('=');
    if (eq >= 0) { flags[body.slice(0, eq)] = body.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[body] = next; i += 1; } else { flags[body] = true; }
  }
  return { positional, flags };
}

/**
 * `je orders set-status JE-1 shipped --yes` → { command: 'orders.set-status', args: {...}, confirm: true, ... }.
 * Devolve `help: true` para `help`/sem argumentos.
 */
export function parseArgv(argv) {
  const { positional, flags } = tokenize(argv);
  const options = { json: flags.json === true, raw: flags.raw === true, debug: flags.debug === true };
  const confirm = flags.yes === true || flags.yes === 'true';
  if (!positional.length || positional[0] === 'help' || flags.help === true) return { help: true, options };

  let command;
  let rest;
  const first = positional[0];
  if (Object.hasOwn(SINGLE, first)) {
    command = SINGLE[first];
    rest = positional.slice(1);
  } else if (GROUPS.has(first)) {
    const action = positional[1];
    if (!action) throw new UsageError(`falta a ação: je ${first} <ação> (veja "je help")`);
    command = `${first}.${action}`;
    rest = positional.slice(2);
  } else {
    throw new UsageError(`comando desconhecido: "${first}" (veja "je help")`);
  }

  const args = {};
  const names = POSITIONALS[command] || [];
  if (rest.length > names.length) throw new UsageError(`argumento(s) a mais: ${rest.slice(names.length).join(' ')}`);
  names.forEach((name, i) => {
    if (rest[i] !== undefined) args[name] = cast(name, rest[i]);
  });

  const aliases = ALIASES[command] || {};
  const consumed = new Set(['json', 'raw', 'debug', 'yes', 'help']);
  const set = {};
  let stock;

  for (const [flag, value] of Object.entries(flags)) {
    if (consumed.has(flag)) continue;
    if (command === 'products.update') {
      if (flag === 'set') {
        try { Object.assign(set, JSON.parse(value)); } catch { throw new UsageError('--set precisa ser JSON válido, ex.: --set \'{"discountPercent":10}\''); }
        continue;
      }
      if (PRODUCT_SET[flag]) {
        const [field, kind] = PRODUCT_SET[flag];
        set[field] = kind === 'number' ? cast('value', value) : castBool(flag, value);
        continue;
      }
      if (flag === 'price-small' || flag === 'price-large') {
        set.prices = { ...(set.prices || {}), [flag.slice(6)]: cast('value', value) };
        continue;
      }
      if (flag === 'stock') { stock = { ...(stock || {}), unlimited: false, quantity: cast('value', value) }; continue; }
      if (flag === 'unlimited') { stock = { ...(stock || {}), unlimited: castBool('unlimited', value) }; continue; }
    }
    const name = aliases[flag] || camel(flag);
    args[name] = cast(name, value);
  }
  if (command === 'products.update') {
    if (stock) set.stock = { quantity: 0, ...stock };
    args.set = set;
  }
  if (command === 'coupons.create' && args.freeShipping === undefined && flags['free-shipping'] === true) args.freeShipping = true;

  return { command, args, confirm, destructive: DESTRUCTIVE.has(command), options };
}

export const HELP = `je — CLI do site Japan Express (usa uma chave de API de administrador)

Configuração (variáveis de ambiente):
  JE_API_KEY   a chave (je_live_...), criada no painel: Admin > Chaves de API
  JE_API_URL   endereço do site (padrão: https://www.japanexpress-store.com)

Uso:  je <comando> [argumentos] [opções]

Consulta
  je health                              conta pedidos, clientes, cupons e produtos (ativos/ocultos/apagados)
  je whoami                              a chave em uso: escopos e validade
  je stats                               resumo de vendas (o do Dashboard)
  je orders list [--status S] [--search T] [--limit N] [--offset N]
  je orders get <nº do pedido>
  je customers list [--search T] [--limit N] [--offset N]
  je customers get <e-mail>              perfil, login e pedidos
  je products list [--category C] [--search T] [--hidden true] [--deleted true] [--limit N] [--offset N]
  je products get <id>                   inclui o custo
  je coupons list
  je audit                               o que as chaves de API fizeram

Alteração
  je orders set-status <nº> <status>     pending|processing|confirmed|shipped|delivered|cancelled
  je orders set-tracking <nº> --number AB123 --carrier Yamato [--url https://...]
  je products update <id> [--discount 10] [--hidden true] [--featured true] [--new true]
                          [--stock 5] [--unlimited true] [--price-small ¥] [--price-large ¥] [--cost ¥]
                          [--set '{"discountPercent":10}']
  je coupons create <CÓDIGO> --type percent|fixed --value N [--days 30] [--description T]
                          [--usage-limit N] [--min-order ¥] [--free-shipping]
  je coupons set-active <CÓDIGO> true|false

Páginas: as listas mostram até 100 por vez e respondem total e hasMore; use --offset para a próxima.

Apaga (exige --yes)
  je customers delete <e-mail> --yes     login, perfil, desejos e carrinho (os pedidos ficam)
  je orders delete <nº> --yes            registro financeiro: prefira "set-status cancelled"
  je coupons delete <CÓDIGO> --yes

Opções gerais:  --json (padrão, formatado)  --raw (numa linha)  --debug (mostra o pedido, sem a chave)
Saída: 0 ok · 1 erro do servidor · 2 uso incorreto · 3 falta --yes
`;
