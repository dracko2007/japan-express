// A conta do Merchant tem teto de produtos (capacidade): o feed aceita ?limit=N e entrega os N de maior prioridade.
import { describe, expect, it } from 'vitest';
import { parseLimit, prioritizeProducts } from '../feed.js';

describe('feed: limite de itens', () => {
  it('só aceita inteiro de 1 a 5000; o resto vale "sem limite"', () => {
    expect(parseLimit('100')).toBe(100);
    expect(parseLimit(['25', '9'])).toBe(25);
    for (const bad of [undefined, '', '0', '-3', '1.5', 'abc', '5001']) expect(parseLimit(bad)).toBe(0);
  });

  it('destaques primeiro, depois mais vendidos, com desempate estável pelo id', () => {
    const ordered = prioritizeProducts([
      { id: 'c', salesCount: 5 },
      { id: 'a', salesCount: 5 },
      { id: 'b', salesCount: 50 },
      { id: 'z', featured: true, salesCount: 0 },
      { id: 'y', featured: false },
    ]);
    expect(ordered.map((p) => p.id)).toEqual(['z', 'b', 'a', 'c', 'y']);
  });

  it('não altera a lista original', () => {
    const original = [{ id: 'b' }, { id: 'a' }];
    prioritizeProducts(original);
    expect(original.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
