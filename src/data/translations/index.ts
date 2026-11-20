import { products } from '../products';
import { pt } from './pt';
import { en } from './en';
import { ja } from './ja';

export type Language = 'pt' | 'en' | 'ja';

export const translations: Record<Language, Record<string, string>> = { pt, en, ja };

export const languageNames: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  ja: '日本語',
};

export const languageFlags: Record<Language, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
};

const productIdToKey: Record<string, string> = {
  'art-cremoso': 'cremoso',
  'art-coco': 'coco',
  'art-amendoim': 'amendoim',
  'prem-cafe': 'cafe',
  'prem-amendoas': 'amendoas',
  'prem-matcha': 'matcha',
  'prem-chocolate': 'chocolate',
  'doce-de-leite': 'docedeleite',
  'biore-uv': 'biore',
  'kitkat-matcha': 'matchakitkat',
  'luffy-figure': 'luffy',
  'kawaii-lamp': 'gatinho',
  'sakura-pens': 'canetassan',
  'muji-organizer': 'organizador',
  'sencha-tea': 'chaverde',
};

export const getTranslatedProductName = (productId: string, _t: (key: string) => string): string => {
  const prod = products.find(p => p.id === productId);
  return prod ? prod.name : productId;
};

export const getTranslatedProductDesc = (productId: string, t: (key: string) => string): string => {
  const key = productIdToKey[productId];
  if (!key) {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.description || '' : '';
  }
  const translated = t("product." + key + ".desc");
  if (translated === "product." + key + ".desc" || translated === key) {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.description || '' : '';
  }
  return translated;
};

export const getTranslatedProductFlavor = (productId: string, t: (key: string) => string): string => {
  const key = productIdToKey[productId];
  if (!key) {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.flavor || '' : '';
  }
  const translated = t("product." + key + ".flavor");
  if (translated === "product." + key + ".flavor" || translated === key) {
    const prod = products.find(p => p.id === productId);
    return prod ? prod.flavor || '' : '';
  }
  return translated;
};
