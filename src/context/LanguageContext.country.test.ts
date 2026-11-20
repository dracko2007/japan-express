// `?pais=br` nos links do feed: a página mostra o Brasil mesmo quando o IP é de outro país.
import { describe, expect, it } from 'vitest';
import { countryFromUrl } from './LanguageContext';

describe('countryFromUrl', () => {
  it('?pais=br (qualquer caixa) vira Brasil', () => {
    expect(countryFromUrl('?pais=br')).toBe('Brasil');
    expect(countryFromUrl('?utm=x&pais=BR')).toBe('Brasil');
  });

  it('sem parâmetro, vazio ou código desconhecido: null', () => {
    expect(countryFromUrl('')).toBeNull();
    expect(countryFromUrl('?pais=')).toBeNull();
    expect(countryFromUrl('?pais=zz')).toBeNull();
    expect(countryFromUrl('?outro=br')).toBeNull();
  });
});
