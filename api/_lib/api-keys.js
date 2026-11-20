import { createHash, randomBytes } from 'node:crypto';
import { adminDb } from './firebase-admin.js';
import { getHeader, HttpError } from './http.js';

/**
 * Chaves de API da CLI (`scripts/cli/je.mjs`). Uma chave dá acesso de administrador à loja SEM sessão de
 * navegador, então o desenho assume que ela pode vazar:
 *
 *  - Guardada só como hash (SHA-256). A chave é aleatória de 256 bits, então hash simples basta e a busca é
 *    direta pelo id do documento. O texto da chave aparece UMA vez, ao criar.
 *  - Tem validade (padrão 90 dias, máximo 365) e pode ser revogada na hora.
 *  - Tem escopos: `read`, `write` e `destructive`. Ação destrutiva ainda exige confirmação explícita no pedido.
 *  - Cada comando fica registrado (`api_key_audit`), com a chave, o comando e o resultado.
 *
 * As coleções `api_keys` e `api_key_audit` NÃO têm regra no `firestore.rules`: o cliente (nem o admin do painel)
 * lê ou grava; só o servidor, pelo Admin SDK.
 */
export const KEY_PREFIX = 'je_live_';
export const SCOPES = ['read', 'write', 'destructive'];
export const DEFAULT_DAYS = 90;
export const MAX_DAYS = 365;
const LAST_USED_THROTTLE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function generateApiKey() {
  return `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(key) {
  return createHash('sha256').update(String(key)).digest('hex');
}

/** Trecho que identifica a chave na listagem sem revelá-la (`je_live_Ab3dEf9x…`). */
export function keyPreview(key) {
  return `${String(key).slice(0, KEY_PREFIX.length + 6)}…`;
}

function bearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(getHeader(req, 'authorization') || ''));
  return match?.[1]?.trim() || '';
}

/**
 * Autentica o pedido pela chave. Toda falha responde o mesmo 401: quem erra a chave não descobre se ela
 * existe, expirou ou foi revogada.
 */
export async function authenticateApiKey(req, { now = Date.now() } = {}) {
  const key = bearer(req);
  if (!key.startsWith(KEY_PREFIX) || key.length < KEY_PREFIX.length + 30 || key.length > 200) {
    throw new HttpError(401, 'unauthorized');
  }
  const ref = adminDb().collection('api_keys').doc(hashApiKey(key));
  let snap;
  try {
    snap = await ref.get();
  } catch {
    throw new HttpError(503, 'authorization_unavailable');
  }
  const data = snap.exists ? snap.data() : null;
  if (!data || data.revokedAt || !(Number(data.expiresAt) > now)) throw new HttpError(401, 'unauthorized');

  // Marca o uso sem gravar a cada comando (uma gravação por minuto no máximo).
  if (!(now - Number(data.lastUsedAt || 0) < LAST_USED_THROTTLE_MS)) {
    ref.update({ lastUsedAt: now }).catch(() => undefined);
  }
  return {
    keyId: String(data.id),
    name: String(data.name || ''),
    scopes: Array.isArray(data.scopes) ? data.scopes.filter((s) => SCOPES.includes(s)) : [],
    expiresAt: Number(data.expiresAt),
  };
}

/** Cria a chave. Devolve o TEXTO da chave: é a única vez que ele existe fora do computador de quem a recebe. */
export async function createApiKey({ name, scopes, days = DEFAULT_DAYS, createdBy, now = Date.now() }) {
  const cleanName = String(name || '').trim();
  if (!cleanName || cleanName.length > 80) throw new HttpError(400, 'invalid_request');
  const cleanScopes = [...new Set(Array.isArray(scopes) ? scopes : [])];
  if (!cleanScopes.length || cleanScopes.some((s) => !SCOPES.includes(s))) throw new HttpError(400, 'invalid_scopes');
  const lifetime = Math.floor(Number(days));
  if (!Number.isFinite(lifetime) || lifetime < 1 || lifetime > MAX_DAYS) throw new HttpError(400, 'invalid_expiry');

  const key = generateApiKey();
  const id = randomBytes(8).toString('hex');
  const expiresAt = now + lifetime * DAY_MS;
  await adminDb().collection('api_keys').doc(hashApiKey(key)).set({
    id,
    name: cleanName,
    preview: keyPreview(key),
    scopes: cleanScopes,
    createdAt: now,
    createdBy: String(createdBy || ''),
    expiresAt,
    revokedAt: null,
    lastUsedAt: 0,
  });
  return { key, id, name: cleanName, scopes: cleanScopes, expiresAt };
}

export async function listApiKeys() {
  const snap = await adminDb().collection('api_keys').get();
  return snap.docs
    .map((document) => {
      const d = document.data();
      return {
        id: d.id,
        name: d.name,
        preview: d.preview,
        scopes: d.scopes,
        createdAt: d.createdAt,
        createdBy: d.createdBy,
        expiresAt: d.expiresAt,
        revokedAt: d.revokedAt || null,
        lastUsedAt: d.lastUsedAt || 0,
      };
    })
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

/** Revoga pelo `id` público (o hash nunca sai do servidor). Revogar de novo é inofensivo. */
export async function revokeApiKey(id, { now = Date.now() } = {}) {
  const snap = await adminDb().collection('api_keys').where('id', '==', String(id)).limit(1).get();
  if (snap.empty) throw new HttpError(404, 'api_key_not_found');
  const document = snap.docs[0];
  if (!document.data().revokedAt) await document.ref.update({ revokedAt: now });
  return { id: String(id) };
}

/**
 * Registro de cada comando. Gravação OBRIGATÓRIA antes de qualquer escrita: se o registro falhar, o comando
 * não roda (nenhuma alteração sem rastro).
 */
export async function recordAudit({ keyId, name, command, args, ip, now = Date.now() }) {
  return adminDb().collection('api_key_audit').add({
    keyId,
    name,
    command,
    args: redactArgs(args),
    ok: null, // preenchido por `finishAudit` quando o comando termina
    status: 'started',
    ip: ip || '',
    at: now,
  });
}

/** Completa o registro com o resultado. Falhar aqui não desfaz o comando (já foi feito e registrado como iniciado). */
export async function finishAudit(ref, { ok, status }) {
  try {
    await ref.update({ ok, status });
  } catch {
    // o registro "started" continua lá; é o que importa para rastrear
  }
}

const SENSITIVE = /(password|senha|token|secret|key|authorization)/i;

/** Nunca grava segredo no registro: campos com nome sensível viram `[omitido]`, textos longos são cortados. */
export function redactArgs(args) {
  const walk = (value, depth) => {
    if (depth > 3) return '[...]';
    if (Array.isArray(value)) return value.slice(0, 20).map((v) => walk(v, depth + 1));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).slice(0, 30).map(([k, v]) => [k, SENSITIVE.test(k) ? '[omitido]' : walk(v, depth + 1)]));
    }
    if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
    return value;
  };
  return walk(args ?? {}, 0);
}
