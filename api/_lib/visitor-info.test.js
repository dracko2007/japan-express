import { describe, expect, it } from 'vitest';
import { bumpCount, mergeCounts, parseDevice, statKey, visitorGeo } from './visitor-info.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

describe('aparelho e sistema pelo navegador', () => {
  it('separa celular, tablet e computador, com o sistema', () => {
    expect(parseDevice(IPHONE)).toEqual({ device: 'mobile', os: 'iOS' });
    expect(parseDevice(ANDROID)).toEqual({ device: 'mobile', os: 'Android' });
    expect(parseDevice(ANDROID_TABLET)).toEqual({ device: 'tablet', os: 'Android' });
    expect(parseDevice(IPAD)).toEqual({ device: 'tablet', os: 'iOS' });
    expect(parseDevice(WINDOWS)).toEqual({ device: 'desktop', os: 'Windows' });
    expect(parseDevice(MAC)).toEqual({ device: 'desktop', os: 'macOS' });
    expect(parseDevice('')).toEqual({ device: 'outro', os: 'Outro' });
  });
});

describe('local da visita pelos cabeçalhos da Vercel (sem IP)', () => {
  it('lê país, estado e cidade, decodifica a cidade e descarta lixo', () => {
    const geo = visitorGeo({ headers: { 'x-vercel-ip-country': 'br', 'x-vercel-ip-country-region': 'SP', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-forwarded-for': '203.0.113.9' } });
    expect(geo).toEqual({ country: 'BR', region: 'SP', city: 'São Paulo' });
    expect(JSON.stringify(geo)).not.toContain('203.0.113.9');
    expect(visitorGeo({ headers: { 'x-vercel-ip-country': 'XYZ' } })).toEqual({ country: '', region: '', city: '' });
    expect(visitorGeo({ headers: {} })).toEqual({ country: '', region: '', city: '' });
  });

  it('chaves de mapa não levam caracteres proibidos do Firestore', () => {
    expect(statKey('a.b/c[d]*e')).toBe('a b c d e');
    expect(statKey('x'.repeat(200)).length).toBe(60);
  });
});

describe('contadores', () => {
  it('soma 1, respeita o limite de chaves e ignora chave vazia', () => {
    expect(bumpCount({ BR: 2 }, 'BR')).toEqual({ BR: 3 });
    expect(bumpCount({}, 'JP')).toEqual({ JP: 1 });
    expect(bumpCount({ A: 1 }, '')).toEqual({ A: 1 });
    expect(bumpCount({ A: 1, B: 1 }, 'C', 2)).toEqual({ A: 1, B: 1 });
    expect(bumpCount({ A: 'lixo' }, 'A')).toEqual({ A: 1 });
    expect(mergeCounts({ BR: 2, JP: 1 }, { BR: 3, US: 1 })).toEqual({ BR: 5, JP: 1, US: 1 });
  });
});
