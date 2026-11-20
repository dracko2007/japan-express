import { adminDb } from '../_lib/firebase-admin.js';
import { authenticateApiKey, finishAudit, recordAudit } from '../_lib/api-keys.js';
import { COMMANDS, commandNames } from '../_lib/cli-commands.js';
import { assertExactKeys, getHeader, handleCors, HttpError, parseJsonObject, requiredText, sendError } from '../_lib/http.js';
import { enforceRateLimit } from '../_lib/rate-limit.js';

/**
 * `POST /api/admin?action=cli` — executa um comando da CLI autenticado por chave de API
 * (`Authorization: Bearer je_live_...`). Corpo: `{ command, args?, confirm? }`.
 *
 * Ordem das travas: limite por endereço → chave (válida, não expirada, não revogada) → limite por chave →
 * comando existe → escopo da chave → confirmação (destrutivo) → registro de auditoria → execução.
 */
export default async function handleCli(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;
  let audit = null;
  try {
    // Antes de autenticar: quem testa chaves às cegas é freado pelo endereço.
    await enforceRateLimit(req, { scope: 'cli:ip', limit: 120, windowMs: 60 * 1000 });
    const key = await authenticateApiKey(req);
    await enforceRateLimit(req, { scope: 'cli:key', limit: 120, windowMs: 60 * 1000, identity: key.keyId });

    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['command', 'args', 'confirm']);
    const command = requiredText(body.command, { max: 60 });
    const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
    const definition = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
    if (!definition) throw new HttpError(404, 'unknown_command', `Comando desconhecido: ${command}`, { commands: commandNames() });
    if (!key.scopes.includes(definition.scope)) {
      throw new HttpError(403, 'insufficient_scope', `Esta chave não tem o escopo "${definition.scope}".`, { required: definition.scope });
    }
    if (definition.scope === 'destructive' && body.confirm !== true) {
      throw new HttpError(409, 'confirmation_required', 'Ação destrutiva: confirme explicitamente (--yes).', { command });
    }

    // Nenhuma alteração sem rastro: se não der para registrar, o comando não roda.
    const ip = String(getHeader(req, 'x-forwarded-for') || req.socket?.remoteAddress || '').split(',')[0].trim();
    try {
      audit = await recordAudit({ keyId: key.keyId, name: key.name, command, args, ip });
    } catch {
      if (definition.scope !== 'read') throw new HttpError(503, 'audit_unavailable');
    }

    const result = await definition.run({ db: adminDb(), args, key });
    if (audit) await finishAudit(audit, { ok: true, status: 'ok' });
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ ok: true, command, result });
  } catch (error) {
    if (audit) await finishAudit(audit, { ok: false, status: error instanceof HttpError ? error.code : 'internal_error' });
    console.error('[cli]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}
