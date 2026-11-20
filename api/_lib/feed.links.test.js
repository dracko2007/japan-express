// O Google lê a página a partir dos EUA; o site escolhe o país pelo IP. O link do feed do Brasil fixa o país.
import { describe, expect, it } from 'vitest';
import { productLinks } from '../feed.js';

describe('links do feed', () => {
  it('feed do Brasil: o link fixa o país e o canonical não tem parâmetro', () => {
    expect(productLinks('abc', 'br')).toEqual({
      link: 'https://www.japanexpress-store.com/produto/abc?pais=br',
      canonical: 'https://www.japanexpress-store.com/produto/abc',
    });
  });

  it('outras regiões não mudam', () => {
    for (const region of ['eu', 'us']) {
      const { link, canonical } = productLinks('abc', region);
      expect(link).toBe(canonical);
    }
  });
});
