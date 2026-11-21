// A estatística de visitantes recusava (400) as páginas que não estavam numa lista curta do servidor:
// privacidade, termos, cookies, devolução, empresas, promoção, afiliado... nunca eram contadas.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./mailer.js', () => ({ MAIL_REPLY_TO: 'x@x', sendMail: vi.fn(), siteOrigin: () => 'https://x', unsubscribeUrl: () => 'x', wrapEmail: (html) => html }));
vi.mock('./push.js', () => ({ sendPush: vi.fn() }));

import { isTrackablePage } from '../public-forms.js';

// Rotas que não são páginas da loja para a estatística: ações de conta, ferramentas internas e o "resto".
const FORA = new Set(['*', '/conta/acao', '/firebase-sync', '/sync-data']);

function rotasDoApp() {
  const app = readFileSync('src/App.tsx', 'utf8');
  return [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((path) => !FORA.has(path));
}

describe('páginas que entram na estatística de visitantes', () => {
  it('toda página pública do app é aceita pelo servidor (o `:param` vira um valor qualquer)', () => {
    const rotas = rotasDoApp();
    expect(rotas.length).toBeGreaterThan(20);
    const recusadas = rotas.filter((path) => !isTrackablePage(path.replace(/:[A-Za-z]+/g, 'exemplo')));
    expect(recusadas).toEqual([]);
  });

  it('as páginas legais, que davam 400, agora entram', () => {
    for (const slug of ['/privacidade', '/termos', '/cookies', '/devolucao', '/return-policy', '/empresas', '/promocao', '/afiliado']) {
      expect(isTrackablePage(slug), slug).toBe(true);
    }
  });

  it('caminho inventado, com barra extra ou com contrabarra continua recusado', () => {
    for (const slug of ['', 'privacidade', '/privacidade/extra', '/nao-existe', '/admin/usuarios', '/conta/acao', '\\privacidade', '/a\\b', '/../etc/passwd', null, undefined, 42]) {
      expect(isTrackablePage(slug), String(slug)).toBe(false);
    }
  });
});
