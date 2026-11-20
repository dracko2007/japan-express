// O link de confirmação/redefinição é o primeiro e-mail que o cliente recebe.
// Se ele apontar para `localstorage-98492.firebaseapp.com`, parece phishing e o
// cliente não clica. Estes testes fixam que o link sai no domínio da loja.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  gerarLink: vi.fn(),
}));

vi.mock('./firebase-admin.js', () => ({
  adminAuth: () => ({ generateEmailVerificationLink: mocks.gerarLink }),
  adminDb: () => ({}),
}));
vi.mock('./auth.js', () => ({
  requireUser: async () => ({ uid: 'u1', email: 'cliente@exemplo.com' }),
  requireAdmin: async () => ({ uid: 'a1' }),
}));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: async () => undefined }));
vi.mock('./mailer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendMail: mocks.sendMail,
}));

const { brandActionLink, handleEmail } = await import('../notify.js');
const { MAIL_FROM, MAIL_FROM_NOREPLY } = await import('./mailer.js');

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

// A confirmação de cadastro ia para o spam em Gmail, Yahoo e Outlook enquanto a
// confirmação de pedido chegava na caixa de entrada. A diferença era o remetente:
// noreply@ do domínio principal (sem histórico) contra contato@mail. (com histórico).
describe('remetente da confirmação de cadastro', () => {
  beforeEach(() => {
    mocks.sendMail.mockReset().mockResolvedValue({ accepted: ['x'] });
    mocks.gerarLink.mockReset().mockResolvedValue(FIREBASE);
  });

  it('sai do remetente padrão da loja, o mesmo da confirmação de pedido', async () => {
    const res = { statusCode: 200, body: null, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; }, end() { return this; } };
    await handleEmail({ method: 'POST', headers: {}, body: { type: 'verify', to: 'cliente@exemplo.com', name: 'Ana' } }, res);

    expect(res.statusCode).toBe(200);
    const enviado = mocks.sendMail.mock.calls[0][0];
    expect(enviado.subject).toMatch(/Confirme seu e-mail/);
    expect(enviado.from ?? MAIL_FROM).toBe(MAIL_FROM);
    expect(enviado.from).not.toBe(MAIL_FROM_NOREPLY);
    expect(enviado.html).toContain('https://japanexpress-store.com/conta/acao?mode=verifyEmail');
  });
});
