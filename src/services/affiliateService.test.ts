import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/config/firebase', () => ({ db: null, auth: null }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), runTransaction: vi.fn(),
}));
vi.mock('@/utils/adminAuth', () => ({ ensureAdminAuth: vi.fn() }));
vi.mock('@/services/publicSubmissionService', () => ({ submitPublicForm: vi.fn() }));
vi.mock('@/services/authenticatedFetch', () => ({ authenticatedFetch: mocks.authenticatedFetch }));

const { affiliateService } = await import('./affiliateService');

beforeEach(() => {
  mocks.authenticatedFetch.mockReset();
  localStorage.clear();
});

describe('cadastro pelo link ou código de um parceiro', () => {
  it('avisa o servidor com o código da sessão, em maiúsculas', async () => {
    localStorage.setItem('affiliate_ref', 'amiga10');
    mocks.authenticatedFetch.mockResolvedValue({ ok: true });
    await affiliateService.trackSignup();
    expect(mocks.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mocks.authenticatedFetch.mock.calls[0];
    expect(url).toBe('/api/affiliates');
    expect(JSON.parse(init.body)).toEqual({ action: 'track-signup', code: 'AMIGA10' });
  });

  it('não chama o servidor quando a pessoa não veio por link/código', async () => {
    await affiliateService.trackSignup();
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled();
  });

  it('uma falha de rede nunca atrapalha o cadastro', async () => {
    localStorage.setItem('affiliate_ref', 'AMIGA10');
    mocks.authenticatedFetch.mockRejectedValue(new Error('offline'));
    await expect(affiliateService.trackSignup()).resolves.toBeUndefined();
  });
});

describe('estatísticas por código', () => {
  it('pede a visão do admin só quando for admin e devolve null em caso de erro', async () => {
    mocks.authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ codes: {}, totals: { visits: 0 } }) });
    await affiliateService.getCodeStats(true);
    expect(JSON.parse(mocks.authenticatedFetch.mock.calls[0][1].body)).toEqual({ action: 'code-stats', admin: true });
    await affiliateService.getCodeStats();
    expect(JSON.parse(mocks.authenticatedFetch.mock.calls[1][1].body)).toEqual({ action: 'code-stats' });

    mocks.authenticatedFetch.mockResolvedValue({ ok: false, status: 403 });
    expect(await affiliateService.getCodeStats(true)).toBeNull();
  });
});
