// CLI `je` (scripts/cli): interpretação da linha de comando e a conversa com o servidor, sem rede.
import { describe, expect, it, vi } from 'vitest';
import { parseArgv, UsageError } from '../../scripts/cli/args.mjs';
import { main } from '../../scripts/cli/je.mjs';

const KEY = 'je_live_SEGREDO_QUE_NAO_PODE_APARECER_EM_SAIDA';

function run(argv, { env = { JE_API_KEY: KEY }, response } = {}) {
  const out = [];
  const err = [];
  const fetch = vi.fn(async () => response ?? { ok: true, status: 200, json: async () => ({ ok: true, result: { fine: 1 } }) });
  return main(argv, { env, fetch, out: (t) => out.push(t), err: (t) => err.push(t) }).then((code) => ({ code, out, err, fetch }));
}

describe('parseArgv', () => {
  it('comandos de uma palavra e de grupo', () => {
    expect(parseArgv(['health']).command).toBe('health');
    expect(parseArgv(['audit']).command).toBe('audit.list');
    expect(parseArgv(['orders', 'list', '--status', 'shipped', '--limit', '10'])).toMatchObject({
      command: 'orders.list', args: { status: 'shipped', limit: 10 },
    });
  });

  it('argumentos posicionais e apelidos', () => {
    expect(parseArgv(['orders', 'set-status', 'JE-1', 'shipped']).args).toEqual({ orderNumber: 'JE-1', status: 'shipped' });
    expect(parseArgv(['orders', 'set-tracking', 'JE-1', '--number', 'AB1', '--carrier', 'Yamato', '--url=https://x.y']).args)
      .toEqual({ orderNumber: 'JE-1', trackingNumber: 'AB1', carrier: 'Yamato', trackingUrl: 'https://x.y' });
  });

  it('products update monta o objeto set', () => {
    const { args } = parseArgv(['products', 'update', 'p1', '--discount', '10', '--hidden', 'true', '--price-small', '1200', '--stock', '5']);
    expect(args).toEqual({ id: 'p1', set: { discountPercent: 10, hidden: true, prices: { small: 1200 }, stock: { quantity: 5, unlimited: false } } });
    expect(parseArgv(['products', 'update', 'p1', '--set', '{"featured":true}']).args.set).toEqual({ featured: true });
  });

  it('apagar é marcado como destrutivo e --yes vira confirm', () => {
    expect(parseArgv(['customers', 'delete', 'a@b.c'])).toMatchObject({ destructive: true, confirm: false });
    expect(parseArgv(['customers', 'delete', 'a@b.c', '--yes'])).toMatchObject({ destructive: true, confirm: true });
    expect(parseArgv(['orders', 'list']).destructive).toBe(false);
  });

  it('uso incorreto', () => {
    expect(() => parseArgv(['nada'])).toThrow(UsageError);
    expect(() => parseArgv(['orders'])).toThrow(UsageError);
    expect(() => parseArgv(['orders', 'list', '--limit', 'abc'])).toThrow(UsageError);
    expect(() => parseArgv(['products', 'update', 'p1', '--set', '{ruim'])).toThrow(UsageError);
    expect(() => parseArgv(['orders', 'get', 'a', 'b'])).toThrow(UsageError);
    expect(parseArgv([]).help).toBe(true);
  });
});

describe('je main', () => {
  it('sem chave: não chama o servidor (saída 2)', async () => {
    const r = await run(['health'], { env: {} });
    expect(r.code).toBe(2);
    expect(r.fetch).not.toHaveBeenCalled();
  });

  it('recusa endereço sem https (a chave não viaja aberta)', async () => {
    const r = await run(['health'], { env: { JE_API_KEY: KEY, JE_API_URL: 'http://exemplo.com' } });
    expect(r.code).toBe(2);
    expect(r.fetch).not.toHaveBeenCalled();
  });

  it('destrutivo sem --yes nem chama o servidor (saída 3)', async () => {
    const r = await run(['orders', 'delete', 'JE-1']);
    expect(r.code).toBe(3);
    expect(r.fetch).not.toHaveBeenCalled();
  });

  it('envia o comando com Bearer e confirm, e a chave nunca aparece na saída', async () => {
    const r = await run(['coupons', 'delete', 'X10', '--yes', '--debug']);
    expect(r.code).toBe(0);
    const [url, init] = r.fetch.mock.calls[0];
    expect(url).toBe('https://japanexpress-store.com/api/admin?action=cli');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body)).toEqual({ command: 'coupons.delete', args: { code: 'X10' }, confirm: true });
    expect([...r.out, ...r.err].join('\n')).not.toContain(KEY);
  });

  it('erro do servidor: saída 1 e a chave não vaza', async () => {
    const r = await run(['health'], { response: { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) } });
    expect(r.code).toBe(1);
    expect(r.err.join('\n')).toContain('unauthorized');
    expect([...r.out, ...r.err].join('\n')).not.toContain(KEY);
  });

  it('confirmação exigida pelo servidor: saída 3', async () => {
    const r = await run(['health'], { response: { ok: false, status: 409, json: async () => ({ error: 'confirmation_required' }) } });
    expect(r.code).toBe(3);
  });

  it('falha de rede: saída 1', async () => {
    const out = [];
    const err = [];
    const code = await main(['health'], { env: { JE_API_KEY: KEY }, fetch: async () => { throw new Error('offline'); }, out: (t) => out.push(t), err: (t) => err.push(t) });
    expect(code).toBe(1);
    expect(err.join('')).toContain('offline');
  });
});
