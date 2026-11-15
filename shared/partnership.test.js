import { describe, expect, it } from 'vitest';
import { AFFILIATE_TIERS, PARTNERSHIP_KEYWORDS, partnershipAnswer, partnershipExamples, partnershipPromptBlock } from './partnership.js';
import { agentGroundingText, buildAgentPrompt } from '../api/_lib/assistant-agent.js';
import { ungroundedMoney } from '../api/_lib/money-grounding.js';

const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

describe('programa de parcerias (assistente virtual)', () => {
  it('reconhece perguntas sobre afiliado, divulgador e influencer em pt/en/ja', () => {
    for (const q of ['Como funciona o programa de afiliados?', 'quero ser divulgador', 'sou influencer, posso ganhar comissão?', 'Tem parceria com influenciadores?',
      'how does the affiliate program work', 'can I be a promoter', 'アフィリエイトについて教えて']) {
      expect(PARTNERSHIP_KEYWORDS.test(normalize(q)), q).toBe(true);
    }
    for (const q of ['quanto custa o biore', 'calcular frete', 'cupom de desconto', 'buscar kitkat']) {
      expect(PARTNERSHIP_KEYWORDS.test(normalize(q)), q).toBe(false);
    }
  });

  it('explica os dois programas, como entrar e os níveis, nos 3 idiomas', () => {
    const pt = partnershipAnswer('pt');
    expect(pt).toContain('Afiliado');
    expect(pt).toContain('Divulgador');
    expect(pt).toContain('Afilie-se');
    expect(pt).toContain('Bronze 10%');
    expect(pt).toContain('Prata 15%');
    expect(pt).toContain('Ouro 20%');
    expect(pt).toContain('¥100.000');
    expect(pt).toContain('¥200.000');
    expect(pt).toMatch(/Não há comissão/);
    expect(partnershipAnswer('en')).toMatch(/Promoter[\s\S]*no commission/);
    expect(partnershipAnswer('en')).toContain('¥100,000');
    expect(partnershipAnswer('ja')).toContain('プロモーター');
    expect(partnershipAnswer('xx')).toBe(pt);
  });

  it('a IA recebe a mesma explicação e parcerias deixam de ser "fora do escopo"', () => {
    const prompt = buildAgentPrompt({ country: 'Brasil', currency: 'BRL', language: 'pt' });
    expect(prompt).toContain(partnershipPromptBlock());
    expect(prompt).toContain('inclui o programa de parcerias');
    // Os valores citados vêm do prompt (a trava anti-alucinação aceita o que está no prompt).
    expect(prompt).toContain('¥100.000');
    // A trava de valores não derruba a explicação: tudo em ¥ citado está no prompt.
    expect(ungroundedMoney(partnershipAnswer('pt'), agentGroundingText(prompt, []))).toEqual([]);
  });

  it('níveis e metas são os mesmos do TIER_CONFIG que calcula a comissão', async () => {
    const { TIER_CONFIG } = await import('../src/services/affiliateService');
    expect(TIER_CONFIG.bronze.commissionPercent).toBe(AFFILIATE_TIERS.bronze.percent);
    expect(TIER_CONFIG.silver.commissionPercent).toBe(AFFILIATE_TIERS.silver.percent);
    expect(TIER_CONFIG.gold.commissionPercent).toBe(AFFILIATE_TIERS.gold.percent);
    // Prata sobe ao passar da meta do Bronze; Ouro ao passar da meta da Prata.
    expect(TIER_CONFIG.bronze.goalYen).toBe(AFFILIATE_TIERS.silver.aboveYen);
    expect(TIER_CONFIG.silver.goalYen).toBe(AFFILIATE_TIERS.gold.aboveYen);
  });
});

describe('exemplos para quem pergunta "quanto eu ganho?"', () => {
  it('trazem valores prontos, iguais aos níveis, nos 3 idiomas', () => {
    const pt = partnershipExamples('pt');
    // Lucro de ¥5.000 por venda: 10% = ¥500, 15% = ¥750, 20% = ¥1.000.
    expect(pt).toContain('¥5.000');
    expect(pt).toContain('Bronze recebe ¥500');
    expect(pt).toContain('Prata ¥750');
    expect(pt).toContain('Ouro ¥1.000');
    expect(pt).toContain('¥150.000');
    expect(pt).toContain('Prata (15%)');
    expect(pt).toContain('Ouro (20%)');
    expect(partnershipExamples('en')).toContain('Bronze earns ¥500, Silver ¥750 and Gold ¥1,000');
    expect(partnershipExamples('ja')).toContain('¥750');
  });

  it('a IA é orientada a usar só esses exemplos e todos os valores passam pela trava anti-alucinação', () => {
    const prompt = buildAgentPrompt({ country: 'Brasil', currency: 'BRL', language: 'pt' });
    expect(prompt).toContain(partnershipExamples('pt'));
    expect(prompt).toMatch(/NÃO crie outros valores/);
    expect(ungroundedMoney(partnershipExamples('pt'), agentGroundingText(prompt, []))).toEqual([]);
  });
});
