// O link de confirmação/redefinição é o primeiro e-mail que o cliente recebe.
// Se ele apontar para `localstorage-98492.firebaseapp.com`, parece phishing e o
// cliente não clica. Estes testes fixam que o link sai no domínio da loja.
import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase-admin.js', () => ({ adminAuth: () => ({}), adminDb: () => ({}) }));

const { brandActionLink } = await import('../notify.js');

const FIREBASE =
  'https://localstorage-98492.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=ABC-123_x&apiKey=AIzaKEY&continueUrl=https%3A%2F%2Fjapanexpress-store.com%2Flogin%3Fverified%3D1&lang=en';

describe('brandActionLink', () => {
  it('troca o domínio do Firebase pelo da loja, mantendo só mode e oobCode', () => {
    const link = brandActionLink(FIREBASE);
    const url = new URL(link);
    expect(url.origin).toBe('https://japanexpress-store.com');
    expect(url.pathname).toBe('/conta/acao');
    expect(url.searchParams.get('mode')).toBe('verifyEmail');
    expect(url.searchParams.get('oobCode')).toBe('ABC-123_x');
    expect(link).not.toContain('localstorage');
    expect(link).not.toContain('apiKey');
    expect(link.length).toBeLessThan(FIREBASE.length);
  });

  it('funciona também para redefinição de senha', () => {
    const link = brandActionLink(FIREBASE.replace('verifyEmail', 'resetPassword'));
    expect(new URL(link).searchParams.get('mode')).toBe('resetPassword');
  });

  it('devolve o link original quando não reconhece o formato — nunca um link quebrado', () => {
    expect(brandActionLink('https://link/reset?oob=abc')).toBe('https://link/reset?oob=abc');
    expect(brandActionLink('nao-e-url')).toBe('nao-e-url');
  });
});
