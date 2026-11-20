#!/usr/bin/env node
// CLI do site Japan Express. Fala com `POST /api/admin?action=cli`, autenticada por chave de API de
// administrador (JE_API_KEY). Sem dependências: só Node 18+.
//
//   JE_API_KEY=je_live_... node scripts/cli/je.mjs health
//
// A chave NUNCA é impressa nem gravada em arquivo: ela vem só do ambiente.
import { HELP, parseArgv, UsageError } from './args.mjs';

const EXIT = { ok: 0, server: 1, usage: 2, confirm: 3 };
const TIMEOUT_MS = 30_000;

/** Executa uma linha de comando. `deps` existe para teste (fetch, env e saída substituíveis). */
export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const out = deps.out ?? ((text) => process.stdout.write(`${text}\n`));
  const err = deps.err ?? ((text) => process.stderr.write(`${text}\n`));
  const doFetch = deps.fetch ?? fetch;

  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (error) {
    if (error instanceof UsageError) { err(`Uso incorreto: ${error.message}`); return EXIT.usage; }
    throw error;
  }
  if (parsed.help) { out(HELP); return EXIT.ok; }

  const key = String(env.JE_API_KEY || '').trim();
  if (!key) {
    err('Falta a chave de API. Defina JE_API_KEY (crie em: Admin > Chaves de API).');
    return EXIT.usage;
  }
  const base = String(env.JE_API_URL || 'https://japanexpress-store.com').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(base)) {
    err('JE_API_URL precisa ser https:// (a chave não pode viajar sem criptografia).');
    return EXIT.usage;
  }

  // Ação destrutiva sem --yes: nem chama o servidor. (O servidor também recusa: são duas travas.)
  if (parsed.destructive && !parsed.confirm) {
    err(`"${parsed.command}" apaga dados. Repita o mesmo comando com --yes para confirmar.`);
    return EXIT.confirm;
  }

  const body = { command: parsed.command, ...(Object.keys(parsed.args).length ? { args: parsed.args } : {}), ...(parsed.confirm ? { confirm: true } : {}) };
  if (parsed.options.debug) err(`POST ${base}/api/admin?action=cli ${JSON.stringify(body)}`);

  let response;
  try {
    response = await doFetch(`${base}/api/admin?action=cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    err(`Não consegui falar com o site (${error?.name === 'TimeoutError' ? 'demorou mais de 30 s' : error?.message || error}).`);
    return EXIT.server;
  }

  let payload = null;
  try { payload = await response.json(); } catch { /* resposta sem JSON */ }

  if (!response.ok || !payload?.ok) {
    const code = payload?.error || `http_${response.status}`;
    const detail = payload?.argument ? ` (${payload.argument}${payload.reason ? `: ${payload.reason}` : ''})` : '';
    err(`Erro: ${code}${detail}`);
    if (response.status === 401) err('A chave foi recusada: errada, expirada ou revogada.');
    if (response.status === 403 && payload?.required) err(`Esta chave não tem o escopo "${payload.required}".`);
    if (response.status === 404 && payload?.commands) err(`Comandos do servidor: ${payload.commands.join(', ')}`);
    if (code === 'confirmation_required') return EXIT.confirm;
    return EXIT.server;
  }

  out(parsed.options.raw ? JSON.stringify(payload.result) : JSON.stringify(payload.result, null, 2));
  return EXIT.ok;
}

// Executa só quando chamado direto (não quando importado pelos testes).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('je.mjs')) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
