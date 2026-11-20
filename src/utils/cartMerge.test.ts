import { describe, expect, it } from 'vitest';
import type { CartItem, Product } from '@/types';
import { mergeCarts, toRemoteCart } from '@/utils/cartMerge';

const produto = (id: string): Product => ({ id, name: id, category: 'cosmeticos', prices: { small: 1000 } } as unknown as Product);
const linha = (id: string, quantity: number, size = 'small'): CartItem => ({ product: produto(id), size, quantity });
const catalogo = ['a', 'b', 'c'].map(produto);
const semLimite = () => 99;

describe('mergeCarts', () => {
  it('carrinho do aparelho + da conta: nada se perde', () => {
    const r = mergeCarts([linha('a', 1)], [], { items: [{ productId: 'b', size: 'small', quantity: 2 }], unselected: [] }, catalogo, semLimite);
    expect(r.items.map((i) => `${i.product.id}x${i.quantity}`)).toEqual(['ax1', 'bx2']);
  });

  it('mesma linha nos dois lados: vale a maior quantidade, não a soma', () => {
    const r = mergeCarts([linha('a', 2)], [], { items: [{ productId: 'a', size: 'small', quantity: 3 }], unselected: [] }, catalogo, semLimite);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].quantity).toBe(3);
  });

  it('nunca passa do estoque', () => {
    const r = mergeCarts([linha('a', 2)], [], { items: [{ productId: 'a', size: 'small', quantity: 9 }, { productId: 'b', size: 'small', quantity: 9 }], unselected: [] }, catalogo, () => 4);
    expect(r.items.map((i) => i.quantity)).toEqual([4, 4]);
  });

  it('produto que saiu do catálogo some; quantidade inválida também', () => {
    const r = mergeCarts([], [], { items: [{ productId: 'zzz', size: 'small', quantity: 1 }, { productId: 'a', size: 'small', quantity: 0 }], unselected: [] }, catalogo, semLimite);
    expect(r.items).toEqual([]);
  });

  it('tamanhos diferentes do mesmo produto são linhas diferentes', () => {
    const r = mergeCarts([linha('a', 1, 'small')], [], { items: [{ productId: 'a', size: 'large', quantity: 1 }], unselected: [] }, catalogo, semLimite);
    expect(r.items.map((i) => i.size)).toEqual(['small', 'large']);
  });

  it('desmarcados dos dois lados se juntam, só de linhas que existem', () => {
    const r = mergeCarts([linha('a', 1), linha('b', 1)], ['a|small'], { items: [{ productId: 'c', size: 'small', quantity: 1 }], unselected: ['c|small', 'x|small'] }, catalogo, semLimite);
    expect(r.unselected.sort()).toEqual(['a|small', 'c|small']);
  });

  it('sem carrinho na conta, mantém o do aparelho', () => {
    const r = mergeCarts([linha('a', 2)], ['a|small'], null, catalogo, semLimite);
    expect(r.items).toHaveLength(1);
    expect(r.unselected).toEqual(['a|small']);
  });

  it('brinde nunca é mesclado nem enviado', () => {
    const brinde: CartItem = { ...linha('b', 1), freeGift: true };
    expect(mergeCarts([brinde], [], null, catalogo, semLimite).items).toEqual([]);
    expect(toRemoteCart([linha('a', 1), brinde], []).items).toHaveLength(1);
  });
});

describe('toRemoteCart', () => {
  it('guarda só produto, tamanho, quantidade e rótulo: nada de preço', () => {
    const r = toRemoteCart([{ ...linha('a', 2), variantLabel: 'Kit' }], ['a|small']);
    expect(r).toEqual({ items: [{ productId: 'a', size: 'small', quantity: 2, variantLabel: 'Kit' }], unselected: ['a|small'] });
  });
});
