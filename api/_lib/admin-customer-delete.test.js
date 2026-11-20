// Excluir cliente no painel deixava o login no Firebase Auth: o e-mail ficava "já cadastrado"
// (não dava para recadastrar) e o cliente também não entrava, por não ter mais perfil.
// Estes testes fixam que o servidor apaga o login — e só o de CLIENTE.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    getUserByEmail: vi.fn(),
    revokeRefreshTokens: vi.fn(),
    deleteUser: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));

vi.mock('./firebase-admin.js', () => ({ adminAuth: () => mocks.auth, adminDb: () => ({}) }));
vi.mock('./rate-limit.js', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('./auth.js', () => ({
  requireAdmin: mocks.requireAdmin,
  superAdminEmail: () => 'dono@japanexpress-store.com',
}));

const { handleCustomerDelete } = await import('../admin.js');

function req(body, method = 'POST') {
  return {
    method,
    headers: { origin: 'https://japanexpress-store.com' },
    body: body === undefined ? undefined : JSON.stringify(body),
    socket: { remoteAddress: '127.0.0.1' },
  };
}

function res() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; },
  };
}

const CLIENTE = { uid: 'abc123', email: 'cliente@exemplo.com', customClaims: undefined };

describe('admin?action=customer-delete', () => {
  beforeEach(() => {
    mocks.auth.getUserByEmail.mockReset().mockResolvedValue(CLIENTE);
    mocks.auth.revokeRefreshTokens.mockReset().mockResolvedValue(undefined);
    mocks.auth.deleteUser.mockReset().mockResolvedValue(undefined);
    mocks.requireAdmin.mockReset().mockResolvedValue({ uid: 'admin_dono', email: 'dono@japanexpress-store.com' });
  });

  it('apaga o login do cliente e revoga as sessões', async () => {
    const r = res();
    await handleCustomerDelete(req({ email: 'Cliente@Exemplo.com' }), r);

    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ ok: true, deleted: true });
    expect(mocks.auth.getUserByEmail).toHaveBeenCalledWith('cliente@exemplo.com'); // normalizado
    expect(mocks.auth.revokeRefreshTokens).toHaveBeenCalledWith('abc123');
    expect(mocks.auth.deleteUser).toHaveBeenCalledWith('abc123');
  });

  it('e-mail sem login é sucesso e não apaga nada', async () => {
    mocks.auth.getUserByEmail.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    const r = res();
    await handleCustomerDelete(req({ email: 'ninguem@exemplo.com' }), r);

    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({ ok: true, deleted: false });
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('não apaga conta de administrador por esta rota', async () => {
    mocks.auth.getUserByEmail.mockResolvedValue({ uid: 'admin_maria', email: 'maria@x.com' });
    const r = res();
    await handleCustomerDelete(req({ email: 'maria@x.com' }), r);

    expect(r.statusCode).toBe(403);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('não apaga quem tem a permissão de admin nas claims, mesmo sem prefixo admin_', async () => {
    mocks.auth.getUserByEmail.mockResolvedValue({ uid: 'u9', email: 'x@x.com', customClaims: { admin: true } });
    const r = res();
    await handleCustomerDelete(req({ email: 'x@x.com' }), r);

    expect(r.statusCode).toBe(403);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('não apaga a própria conta de quem está logado', async () => {
    mocks.requireAdmin.mockResolvedValue({ uid: 'abc123', email: 'cliente@exemplo.com' });
    const r = res();
    await handleCustomerDelete(req({ email: 'cliente@exemplo.com' }), r);

    expect(r.statusCode).toBe(403);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('não apaga o e-mail do super administrador', async () => {
    const r = res();
    await handleCustomerDelete(req({ email: 'DONO@japanexpress-store.com' }), r);

    expect(r.statusCode).toBe(403);
    expect(mocks.auth.getUserByEmail).not.toHaveBeenCalled();
  });

  it('exige administrador', async () => {
    mocks.requireAdmin.mockRejectedValue(Object.assign(new Error('no'), { status: 401, code: 'unauthorized' }));
    const r = res();
    await handleCustomerDelete(req({ email: 'cliente@exemplo.com' }), r);

    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });

  it('recusa campos extras no corpo', async () => {
    const r = res();
    await handleCustomerDelete(req({ email: 'cliente@exemplo.com', uid: 'outro' }), r);

    expect(r.statusCode).toBe(400);
    expect(mocks.auth.deleteUser).not.toHaveBeenCalled();
  });
});
