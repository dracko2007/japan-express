import { COMPANY_PROFILE } from '@/config/companyProfile';
import type { AssistantAction } from '@/services/assistantTools';

// Formato internacional em toda mensagem: o cliente que lê isto está no Brasil
// e disca de lá. O link `wa.me` usa os dígitos puros, sem `+` nem separador.
export const WHATSAPP = COMPANY_PROFILE.whatsapp.international;
export const WHATSAPP_LINK = `wa.me/${COMPANY_PROFILE.whatsapp.digits}`;

// Comandos que continuam nas regras locais (não precisam de IA nem de ferramentas).
export const LOCAL_SKILL_RE = /\b(limpar|esvaziar|clear|cupom|coupon|novidades|notificac\w*|vlog|depoimentos?|unboxing|japones|nihongo|portugues|ingles|english)\b|日本語/;

export const AGENT_STEP_LABELS: Record<string, Record<'pt' | 'en' | 'ja', string>> = {
  buscar_produtos: { pt: '🔍 Buscando no catálogo…', en: '🔍 Searching the catalog…', ja: '🔍 商品を検索中…' },
  cotar_pedido: { pt: '📦 Calculando frete e total…', en: '📦 Calculating shipping and total…', ja: '📦 送料と合計を計算中…' },
  converter_moeda: { pt: '💱 Convertendo moeda…', en: '💱 Converting currency…', ja: '💱 通貨を換算中…' },
  ver_carrinho: { pt: '🛒 Conferindo o carrinho…', en: '🛒 Checking your cart…', ja: '🛒 カートを確認中…' },
  adicionar_ao_carrinho: { pt: '➕ Adicionando ao carrinho…', en: '➕ Adding to cart…', ja: '➕ カートに追加中…' },
  painel_financeiro: { pt: '📊 Consultando o balanço…', en: '📊 Checking the financials…', ja: '📊 収支を確認中…' },
  margem_produtos: { pt: '💹 Calculando margens…', en: '💹 Calculating margins…', ja: '💹 利益率を計算中…' },
  estoque: { pt: '📦 Conferindo o estoque…', en: '📦 Checking stock…', ja: '📦 在庫を確認中…' },
};

export const ACTION_LABELS: Record<AssistantAction, Record<'pt' | 'en' | 'ja', string>> = {
  finalizar_compra: { pt: '✅ Finalizar compra', en: '✅ Checkout', ja: '✅ 購入手続きへ' },
  ver_carrinho: { pt: '🛒 Ver carrinho', en: '🛒 View cart', ja: '🛒 カートを見る' },
  continuar_comprando: { pt: '🛍️ Continuar comprando', en: '🛍️ Keep shopping', ja: '🛍️ 買い物を続ける' },
  falar_whatsapp: { pt: '💬 Falar no WhatsApp', en: '💬 Chat on WhatsApp', ja: '💬 WhatsAppで相談' },
  faca_seu_pedido: { pt: '📝 Faça seu Pedido', en: '📝 Custom order', ja: '📝 取り寄せ依頼' },
};

// Peso estimado (g) por categoria e variante — usado quando o produto não tem weightGrams.
export const WEIGHT_BY_CATEGORY: Record<string, { small: number; large: number }> = {
  doces:      { small: 280, large: 800 },
  cosmeticos: { small: 200, large: 500 },
  papelaria:  { small: 150, large: 400 },
  acessorios: { small: 300, large: 800 },
};
export const DEFAULT_WEIGHT = { small: 300, large: 800 };

// Turnos de conversa enviados à IA. 6 estourava rápido: uma recomendação seguida
// de duas perguntas de acompanhamento já empurrava o produto para fora da janela.
/** Sem atividade por este tempo, a conversa é limpa. */
export const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos
export const AI_HISTORY_TURNS = 12;
// Agente: menos mensagens (cada chamada reenviaria tudo; o "[contexto]" guarda os produtos).
export const AGENT_HISTORY_MESSAGES = 8;
