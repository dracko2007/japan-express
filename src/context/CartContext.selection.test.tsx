// Marcar quais itens do carrinho vão ser comprados. O cliente às vezes quer deixar um produto no carrinho
// para depois: desmarcar tira do pedido (totais, brindes, checkout) mas não do carrinho.
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/types';

const mocks = vi.hoisted(() => ({ products: [] as Product[] }));

vi.mock('@/context/ProductsContext', () => ({ useProducts: () => ({ products: mocks.products }) }));
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/analytics')>()),
  trackAddToCart: vi.fn(),
}));

import { CartProvider, useCart } from './CartContext';

const produto = (id: string, price: number, extra: Partial<Product> = {}): Product => ({
  id,
  name: id,
  category: 'cosmeticos',
  prices: { small: price, large: price * 2 },
  stock: { unlimited: true, quantity: 0 },
  ...extra,
} as unknown as Product);

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;

function setup() {
  return renderHook(() => useCart(), { wrapper });
}

describe('seleção de itens do carrinho', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.products = [];
  });

  it('item novo entra marcado, e tudo conta como comprado', () => {
    const { result } = setup();
    act(() => {
      result.current.addToCart(produto('a', 1000), 'small');
      result.current.addToCart(produto('b', 2000), 'small');
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.selectedItems).toHaveLength(2);
    expect(result.current.selectedTotalPrice).toBe(3000);
  });

  it('desmarcar tira o item do pedido, mas ele continua no carrinho', () => {
    const { result } = setup();
    act(() => {
      result.current.addToCart(produto('a', 1000), 'small');
      result.current.addToCart(produto('b', 2000), 'small');
    });
    act(() => result.current.toggleItemSelected('b', 'small'));

    expect(result.current.items).toHaveLength(2);                  // carrinho inteiro
    expect(result.current.totalItems).toBe(2);                     // o selo do cabeçalho não muda
    expect(result.current.totalPrice).toBe(3000);                  // carrinho inteiro
    expect(result.current.selectedItems.map((i) => i.product.id)).toEqual(['a']);
    expect(result.current.selectedTotalPrice).toBe(1000);
    expect(result.current.isItemSelected(result.current.items[1])).toBe(false);

    act(() => result.current.toggleItemSelected('b', 'small'));
    expect(result.current.selectedItems).toHaveLength(2);          // marcar de novo devolve ao pedido
  });

  it('mesmo produto em tamanhos diferentes é marcado separadamente', () => {
    const { result } = setup();
    act(() => {
      result.current.addToCart(produto('a', 1000), 'small');
      result.current.addToCart(produto('a', 1000), 'large');
    });
    act(() => result.current.toggleItemSelected('a', 'large'));

    expect(result.current.selectedItems.map((i) => `${i.product.id}|${i.size}`)).toEqual(['a|small']);
  });

  it('selecionar todos / desmarcar todos', () => {
    const { result } = setup();
    act(() => {
      result.current.addToCart(produto('a', 1000), 'small');
      result.current.addToCart(produto('b', 2000), 'small');
    });
    act(() => result.current.setAllItemsSelected(false));
    expect(result.current.selectedItems).toHaveLength(0);
    expect(result.current.selectedTotalPrice).toBe(0);
    expect(result.current.items).toHaveLength(2);

    act(() => result.current.setAllItemsSelected(true));
    expect(result.current.selectedItems).toHaveLength(2);
  });

  it('depois do pedido, sai só o que foi comprado: o desmarcado continua no carrinho', () => {
    const { result } = setup();
    act(() => {
      result.current.addToCart(produto('a', 1000), 'small');
      result.current.addToCart(produto('b', 2000), 'small');
    });
    act(() => result.current.toggleItemSelected('b', 'small'));
    act(() => result.current.removePurchasedItems());

    expect(result.current.items.map((i) => i.product.id)).toEqual(['b']);
    // e continua desmarcado: não entra de surpresa no próximo pedido
    expect(result.current.selectedItems).toHaveLength(0);
  });

  it('a escolha sobrevive a recarregar a página', () => {
    const first = setup();
    act(() => {
      first.result.current.addToCart(produto('a', 1000), 'small');
      first.result.current.addToCart(produto('b', 2000), 'small');
    });
    act(() => first.result.current.toggleItemSelected('a', 'small'));
    first.unmount();

    const again = setup();
    expect(again.result.current.items).toHaveLength(2);
    expect(again.result.current.selectedItems.map((i) => i.product.id)).toEqual(['b']);
  });

  it('item removido e adicionado de novo volta marcado', () => {
    const { result } = setup();
    act(() => result.current.addToCart(produto('a', 1000), 'small'));
    act(() => result.current.toggleItemSelected('a', 'small'));
    act(() => result.current.removeFromCart('a', 'small'));
    act(() => result.current.addToCart(produto('a', 1000), 'small'));

    expect(result.current.selectedItems).toHaveLength(1);
  });

  it('o brinde só aparece quando o item que o gera está marcado', () => {
    const brinde = produto('brinde', 500);
    const gerador = produto('gerador', 3000, { promoGift: { buyQuantity: 1, giftProductId: 'brinde' } } as Partial<Product>);
    mocks.products = [brinde, gerador];
    const { result } = setup();
    act(() => result.current.addToCart(gerador, 'small'));
    expect(result.current.selectedItems.some((i) => i.freeGift)).toBe(true);

    act(() => result.current.toggleItemSelected('gerador', 'small'));
    expect(result.current.selectedItems).toHaveLength(0);          // sem item marcado, sem brinde
    expect(result.current.items.filter((i) => i.freeGift)).toHaveLength(0);

    act(() => result.current.toggleItemSelected('gerador', 'small'));
    expect(result.current.selectedItems.some((i) => i.freeGift)).toBe(true);
  });
});
