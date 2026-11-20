// Senha errada mostrava "Usuário não cadastrado. Crie uma conta primeiro.". Para decidir entre "não
// cadastrado" e "senha errada", o login lia o Firestore SEM estar logado — e as regras (corretamente) negam
// essa leitura. O erro da leitura caía no ramo final, e QUALQUER senha errada virava "não cadastrado".
//
// O Firebase Auth devolve o mesmo `auth/invalid-credential` para e-mail inexistente e para senha errada
// (proteção contra descobrir quem tem conta). A mensagem tem que valer para os dois casos.
import React from 'react';
import { render, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loginUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserFromFirestore: vi.fn(),
  onAuthChange: vi.fn((callback: (user: unknown) => void) => { callback(null); return () => undefined; }),
}));

vi.mock('@/config/firebase', () => ({
  app: null,
  auth: { currentUser: null },
  db: null,
  storage: null,
  firebaseConfigReady: true,
  allowLocalOnly: false,
  firebaseDisabled: false,
}));
vi.mock('firebase/auth', () => ({ signInWithCustomToken: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('@/services/adminService', () => ({
  adminService: { authenticate: vi.fn().mockResolvedValue(null), getAdmins: vi.fn(), isSuper: () => false },
}));
vi.mock('@/services/firebaseSyncService', () => ({
  firebaseSyncService: {
    onAuthChange: mocks.onAuthChange,
    loginUser: mocks.loginUser,
    getUserByEmail: mocks.getUserByEmail,
    getUserFromFirestore: mocks.getUserFromFirestore,
    logoutUser: vi.fn(),
    getOrdersPageFromFirestore: vi.fn().mockResolvedValue({ items: [], hasMore: false, nextCursor: null }),
    resendVerificationEmail: vi.fn(),
  },
}));
vi.mock('@/services/referralService', () => ({
  referralService: { captureReferral: vi.fn(), getPendingReferral: vi.fn(() => null), clearPendingReferral: vi.fn(), linkReferral: vi.fn() },
}));
vi.mock('@/lib/analytics', () => ({ trackLogin: vi.fn(), trackSignUp: vi.fn() }));
vi.mock('@/services/mailService', () => ({ sendVerificationEmail: vi.fn() }));

import { UserProvider, useUser } from './UserContext';

interface ResultadoLogin { success: boolean; error?: string; code?: string }
let login: (email: string, senha: string) => Promise<ResultadoLogin>;

function Probe() {
  login = useUser().login as typeof login;
  return null;
}

const erroDoFirebase = (code: string) => Object.assign(new Error(code), { code });

describe('login com credencial recusada pelo Firebase Auth', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.loginUser.mockReset();
    // O que acontece em produção para quem não está logado: as regras negam a leitura.
    mocks.getUserByEmail.mockReset().mockRejectedValue(erroDoFirebase('permission-denied'));
    render(<UserProvider><Probe /></UserProvider>);
  });

  for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
    it(`${code}: não afirma que o usuário não é cadastrado`, async () => {
      mocks.loginUser.mockRejectedValue(erroDoFirebase(code));

      let resultado!: ResultadoLogin;
      await act(async () => { resultado = await login('cliente@exemplo.com', 'senha-errada'); });

      expect(resultado.success).toBe(false);
      expect(resultado.error).not.toMatch(/não cadastrado/i);
      // Serve para os dois casos (senha errada ou e-mail sem conta) e diz o que fazer em cada um.
      expect(resultado.error).toMatch(/e-mail ou senha incorretos/i);
      expect(resultado.error).toMatch(/esqueceu a senha/i);
      expect(resultado.error).toMatch(/cadastr/i);
    });
  }

  it('não consulta o Firestore sem sessão para adivinhar se o e-mail existe', async () => {
    mocks.loginUser.mockRejectedValue(erroDoFirebase('auth/invalid-credential'));
    await act(async () => { await login('cliente@exemplo.com', 'senha-errada'); });

    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
  });

  it('erro de rede continua com a própria mensagem', async () => {
    mocks.loginUser.mockRejectedValue(erroDoFirebase('auth/network-request-failed'));
    let resultado!: ResultadoLogin;
    await act(async () => { resultado = await login('cliente@exemplo.com', 'x'); });

    expect(resultado.error).toMatch(/falha de rede/i);
  });
});
