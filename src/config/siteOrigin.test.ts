// O endereço sem www redireciona (308) para o www: canonical, sitemap e robots precisam apontar para o final.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN } from './siteOrigin';

const APEX = /https:\/\/japanexpress-store\.com/;

describe('endereço canônico do site', () => {
  it('é o www', () => {
    expect(SITE_ORIGIN).toBe('https://www.japanexpress-store.com');
  });

  it.each(['public/robots.txt', 'api/_handlers/sitemap.js', 'shared/company-profile.json'])('%s não aponta para o endereço que redireciona', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(APEX);
  });

  it('o index.html não fixa um canonical (cada página define o seu)', () => {
    expect(readFileSync('index.html', 'utf8')).not.toMatch(/<link rel="canonical"/);
  });

  it('o index.html tem o fallback sem JavaScript com endereço, contato e políticas', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/<noscript>[\s\S]*257-18[\s\S]*contato@japanexpress-store\.com[\s\S]*\/devolucao[\s\S]*<\/noscript>/);
  });
});
