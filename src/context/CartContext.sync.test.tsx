// O carrinho de quem está logado fica guardado na conta: sair e entrar de novo devolve os itens.
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';
import type { RemoteCart } from '@/utils/cartMerge';

const mocks = vi.hoisted(() => ({
  products: [] as Product[],
  authCallback: null as null | ((user: { uid: string; isAnonymous: boolean } | null) => void),
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/context/ProductsContext', () => ({ useProducts: () => ({ products: mocks.products }) }));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/analytics')>()), trackAddToCart: vi.fn() }));
vi.mock('@/config/firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (user: { uid: string; isAnonymous: boolean } | null) => void) => {
    mocks.authCallback = cb;
    return () => { mocks.authCallback = null; };
  },
}));
vi.mock('@/services/cartSyncService', () => ({
  loadRemoteCart: mocks.load,
  saveRemoteCart: mocks.save,
  registerCartFlush: () => () => undefined,
}));

import { CartProvider, useCart } from './CartContext';

const produto = (id: string, price: number): Product => ({ id, name: id, category: 'cosmeticos', prices: { small: price }, stock: { unlimited: true, quantity: 0 } } as unknown as Product);
const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
const entrar = (uid = 'u1') => act(() => { mocks.authCallback?.({ uid, isAnonymous: false }); });

describe('carrinho por conta', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.products = [produto('a', 1000), produto('b', 2000)];
    mocks.load.mockReset().mockResolvedValue(null);
    mocks.save.mockReset().mockResolvedValue(undefined);
  });

  it('ao entrar, traz os itens guardados na conta', async () => {
    const remoto: RemoteCart = { items: [{ productId: 'b', size: 'small', quantity: 2 }], unselected: [] };
    mocks.load.mockResolvedValue(remoto);
    const { result } = renderHook(() => useCart(), { wrapper });
    entrar();

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].product.id).toBe('b');
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('o que o visitante juntou antes de entrar se junta ao da conta e sobe para a nuvem', async () => {
    mocks.load.mockResolvedValue({ items: [{ productId: 'b', size: 'small', quantity: 1 }], unselected: [] });
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(mocks.products[0], 'small'));
    entrar();

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled(), { timeout: 2000 });
    const [uid, enviado] = mocks.save.mock.calls.at(-1) as [string, RemoteCart];
    expect(uid).toBe('u1');
    expect(enviado.items.map((i) => i.productId).sort()).toEqual(['a', 'b']);
  });

  it('não grava nada antes de ler a conta (carrinho vazio do aparelho não apaga o da nuvem)', async () => {
    let liberar: (v: RemoteCart | null) => void = () => undefined;
    mocks.load.mockReturnValue(new Promise<RemoteCart | null>((resolve) => { liberar = resolve; }));
    renderHook(() => useCart(), { wrapper });
    entrar();
    await new Promise((r) => setTimeout(r, 700));

    expect(mocks.save).not.toHaveBeenCalled();
    liberar(null);
  });

  it('falha ao ler a conta: segue só com o aparelho e NÃO grava por cima', async () => {
    mocks.load.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(mocks.products[0], 'small'));
    entrar();
    await new Promise((r) => setTimeout(r, 800));

    expect(result.current.items).toHaveLength(1);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  // A ordem real não é garantida: o evento de logout pode chegar ANTES de o Firebase avisar que a sessão acabou.
  // Nos dois sentidos, o carrinho vazio do aparelho não pode ser gravado por cima do da conta.
  for (const [nome, ordem] of [['evento primeiro', 'evento'], ['sessão primeiro', 'sessao']] as const) {
    it(`sair da conta (${nome}) limpa o aparelho mas nunca grava o carrinho vazio na conta`, async () => {
      mocks.load.mockResolvedValue({ items: [{ productId: 'a', size: 'small', quantity: 1 }], unselected: [] });
      const { result } = renderHook(() => useCart(), { wrapper });
      entrar();
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      await waitFor(() => expect(mocks.save).toHaveBeenCalled(), { timeout: 2000 });
      mocks.save.mockClear();

      if (ordem === 'evento') {
        act(() => { window.dispatchEvent(new Event('japan-express:logout')); });
        expect(result.current.items).toHaveLength(0);
        await new Promise((r) => setTimeout(r, 800)); // a sessão ainda aparece como aberta
        act(() => { mocks.authCallback?.(null); });
      } else {
        act(() => { mocks.authCallback?.(null); });
        act(() => { window.dispatchEvent(new Event('japan-express:logout')); });
        expect(result.current.items).toHaveLength(0);
      }
      await new Promise((r) => setTimeout(r, 800));
      // Com a sessão ainda aberta o carrinho da conta é relido e restaurado (e pode ser regravado); o que
      // nunca pode acontecer é gravar o carrinho VAZIO por cima dele.
      const vazios = mocks.save.mock.calls.filter(([, enviado]) => (enviado as RemoteCart).items.length === 0);
      expect(vazios).toHaveLength(0);
    });
  }

  it('visitante (sem conta) não usa a nuvem', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart(mocks.products[0], 'small'));
    await new Promise((r) => setTimeout(r, 700));

    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
