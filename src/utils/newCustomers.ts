import { safeStorage } from '@/utils/storage';

// "Cliente novo" no painel: conta criada nos últimos dias e que o admin ainda não abriu.
// O "visto" fica neste navegador (conveniência do painel); a data do cadastro vem do servidor.
export const NEW_CUSTOMER_DAYS = 7;
const SEEN_KEY = 'admin_seen_customer_emails';
const SEEN_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const keyOf = (email: string) => email.trim().toLowerCase();

export function loadSeenCustomers(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(safeStorage.getItem(SEEN_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveSeenCustomers(seen: Set<string>): void {
  // Guarda só os mais recentes para a lista não crescer sem limite.
  safeStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT)));
}

/** Conta criada há menos de `NEW_CUSTOMER_DAYS` dias e ainda não vista pelo admin. */
export function isNewCustomer(customer: { email: string; createdAt?: string }, seen: Set<string>, now = Date.now()): boolean {
  if (!customer.createdAt || seen.has(keyOf(customer.email))) return false;
  const created = Date.parse(customer.createdAt);
  return Number.isFinite(created) && created <= now + DAY_MS && now - created < NEW_CUSTOMER_DAYS * DAY_MS;
}

export function markCustomersSeen(emails: string[], seen = loadSeenCustomers()): Set<string> {
  const next = new Set(seen);
  emails.forEach((email) => next.add(keyOf(email)));
  saveSeenCustomers(next);
  return next;
}

/** "Cliente desde 14/11/2026 (há 3 dias)"; vazio quando a data não existe. */
export function memberSince(createdAt?: string, now = Date.now()): string {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(created)) return '';
  const date = new Date(created).toLocaleDateString('pt-BR');
  const days = Math.floor((now - created) / DAY_MS);
  const ago = days <= 0 ? 'hoje' : days === 1 ? 'há 1 dia' : days < 30 ? `há ${days} dias` : days < 365 ? `há ${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? 'mês' : 'meses'}` : `há ${Math.floor(days / 365)} ${Math.floor(days / 365) === 1 ? 'ano' : 'anos'}`;
  return `Cliente desde ${date} (${ago})`;
}
