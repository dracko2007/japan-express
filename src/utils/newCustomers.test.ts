import { beforeEach, describe, expect, it } from 'vitest';
import { NEW_CUSTOMER_DAYS, isNewCustomer, loadSeenCustomers, markCustomersSeen, memberSince } from './newCustomers';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => localStorage.clear());

describe('cliente novo (bolinha vermelha)', () => {
  it('é novo se criou a conta há menos de 7 dias e ainda não foi visto', () => {
    const seen = new Set<string>();
    expect(isNewCustomer({ email: 'a@example.com', createdAt: daysAgo(0.1) }, seen, NOW)).toBe(true);
    expect(isNewCustomer({ email: 'a@example.com', createdAt: daysAgo(NEW_CUSTOMER_DAYS - 1) }, seen, NOW)).toBe(true);
    expect(isNewCustomer({ email: 'a@example.com', createdAt: daysAgo(NEW_CUSTOMER_DAYS + 1) }, seen, NOW)).toBe(false);
  });

  it('cadastro sem data ou data inválida nunca é "novo"', () => {
    expect(isNewCustomer({ email: 'a@example.com' }, new Set(), NOW)).toBe(false);
    expect(isNewCustomer({ email: 'a@example.com', createdAt: 'ontem' }, new Set(), NOW)).toBe(false);
  });

  it('deixa de ser novo depois de visto, sem diferenciar maiúsculas do e-mail, e o visto persiste', () => {
    const customer = { email: 'Maria@Example.com', createdAt: daysAgo(1) };
    expect(isNewCustomer(customer, loadSeenCustomers(), NOW)).toBe(true);
    markCustomersSeen([customer.email]);
    expect(isNewCustomer({ ...customer, email: 'maria@example.com' }, loadSeenCustomers(), NOW)).toBe(false);
    // outro cliente continua novo
    expect(isNewCustomer({ email: 'joao@example.com', createdAt: daysAgo(1) }, loadSeenCustomers(), NOW)).toBe(true);
  });

  it('aguenta storage corrompido', () => {
    localStorage.setItem('admin_seen_customer_emails', '{ruim');
    expect(loadSeenCustomers().size).toBe(0);
  });
});

describe('cliente desde', () => {
  it('mostra a data do cadastro e há quanto tempo', () => {
    expect(memberSince(daysAgo(0), NOW)).toBe('Cliente desde 15/11/2026 (hoje)');
    expect(memberSince(daysAgo(1), NOW)).toBe('Cliente desde 14/11/2026 (há 1 dia)');
    expect(memberSince(daysAgo(10), NOW)).toBe('Cliente desde 05/11/2026 (há 10 dias)');
    expect(memberSince(daysAgo(65), NOW)).toContain('(há 2 meses)');
    expect(memberSince(daysAgo(800), NOW)).toContain('(há 2 anos)');
  });

  it('sem data não mostra nada', () => {
    expect(memberSince(undefined, NOW)).toBe('');
    expect(memberSince('lixo', NOW)).toBe('');
  });
});
