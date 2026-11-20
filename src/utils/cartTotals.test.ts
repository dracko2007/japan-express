import { describe, expect, it } from 'vitest';
import { cartSubtotals } from '@/utils/cartTotals';

interface Linha { id: string; preco: number; quantity: number; freeGift?: boolean; promo?: boolean; comDesconto?: boolean }
const calc = (items: Linha[]) => cartSubtotals(items, {
  isPromo: (i) => i.promo === true,
  isStoreDiscounted: (i) => i.comDesconto === true,
  unit: (i) => i.preco,
});

const normal: Linha = { id: 'bioré', preco: 90, quantity: 1 };
const comDesconto: Linha = { id: 'fino', preco: 54, quantity: 2, comDesconto: true };

describe('cartSubtotals', () => {
  // Regressão: o total do carrinho somava só os itens sem desconto da loja. Com só o produto em
  // promoção marcado, o resumo mostrava R$ 0 e "Finalizar" levava um total errado.
  it('só produto com desconto da loja: o total é o preço dele, não zero', () => {
    const r = calc([comDesconto]);
    expect(r.baseTotalPrice).toBe(108);
    expect(r.regularSubtotal).toBe(0);            // ...mas a base do cupom é zero (desconto não acumula)
    expect(r.storeDiscountedSubtotal).toBe(108);
  });

  it('carrinho misto: o total soma os dois; a base do cupom só o item sem desconto', () => {
    const r = calc([normal, comDesconto]);
    expect(r.baseTotalPrice).toBe(198);
    expect(r.regularSubtotal).toBe(90);
  });

  it('dois produtos com desconto da loja', () => {
    const r = calc([comDesconto, { id: 'oil', preco: 88, quantity: 1, comDesconto: true }]);
    expect(r.baseTotalPrice).toBe(196);
    expect(r.regularSubtotal).toBe(0);
  });

  it('promoção da home entra no total e fica fora da base do cupom', () => {
    const r = calc([normal, { id: 'promo', preco: 50, quantity: 1, promo: true }]);
    expect(r.baseTotalPrice).toBe(140);
    expect(r.promoSubtotal).toBe(50);
    expect(r.regularSubtotal).toBe(90);
  });

  it('brinde não conta em nada', () => {
    const r = calc([normal, { id: 'brinde', preco: 30, quantity: 1, freeGift: true }]);
    expect(r.baseTotalPrice).toBe(90);
  });

  it('item que é promoção da home E tem desconto é contado uma vez só', () => {
    const r = calc([{ id: 'x', preco: 40, quantity: 1, promo: true, comDesconto: true }]);
    expect(r.baseTotalPrice).toBe(40);
  });

  it('carrinho vazio', () => {
    expect(calc([]).baseTotalPrice).toBe(0);
  });

  it('o total é sempre a soma das três partes', () => {
    const r = calc([normal, comDesconto, { id: 'promo', preco: 50, quantity: 3, promo: true }]);
    expect(r.baseTotalPrice).toBe(r.promoSubtotal + r.storeDiscountedSubtotal + r.regularSubtotal);
    expect(r.baseTotalPrice).toBe(90 + 108 + 150);
  });
});
