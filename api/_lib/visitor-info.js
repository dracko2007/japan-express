// De onde e com que aparelho alguém chegou. Só estatística: NUNCA guarda o IP.
// País, estado e cidade vêm dos cabeçalhos de geolocalização da Vercel (aproximados,
// pelo IP); o aparelho vem do navegador (user agent).
import { getHeader } from './http.js';

/** Chave segura para mapa do Firestore (sem . / [ ] * ` ~), com tamanho limitado. */
export function statKey(value, max = 60) {
  return String(value ?? '').replace(/[./[\]*`~\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Aparelho e sistema a partir do user agent. */
export function parseDevice(userAgent) {
  const ua = String(userAgent || '');
  let os = 'Outro';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const mobile = /iPhone|iPod|Mobile/i.test(ua);
  const device = !ua ? 'outro' : tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
  return { device, os };
}

/** País (ISO), estado/região e cidade pelos cabeçalhos da Vercel. */
export function visitorGeo(req) {
  const country = String(getHeader(req, 'x-vercel-ip-country') || '').toUpperCase();
  const region = statKey(getHeader(req, 'x-vercel-ip-country-region') || '', 12);
  let city = String(getHeader(req, 'x-vercel-ip-city') || '');
  try { city = decodeURIComponent(city); } catch { /* mantém como veio */ }
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    region,
    city: statKey(city, 60),
  };
}

/** Soma 1 à chave no mapa de contagem, sem estourar o documento (limite de chaves e do contador). */
export function bumpCount(map, key, maxKeys = 200) {
  const next = { ...(map && typeof map === 'object' ? map : {}) };
  if (!key) return next;
  if (!(key in next) && Object.keys(next).length >= maxKeys) return next;
  const current = Number(next[key]);
  next[key] = (Number.isSafeInteger(current) && current >= 0 ? current : 0) + 1;
  return next;
}

/** Soma dois mapas de contagem. */
export function mergeCounts(target, source) {
  const out = { ...target };
  for (const [key, value] of Object.entries(source || {})) out[key] = (Number(out[key]) || 0) + (Number(value) || 0);
  return out;
}
