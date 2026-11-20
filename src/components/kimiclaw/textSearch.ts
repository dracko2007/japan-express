// Busca por texto do assistente: normalização, palavras úteis e detecção de categoria. Funções puras.

// Normalize text for search - remove accents and lowercase
// Aceita campo vazio: um único produto sem descrição/sabor derrubava a busca
// inteira (TypeError) e o chat respondia "Desculpe, tive um problema".
export const normalizeText = (text: string | null | undefined): string => {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
};

// Palavras de ligação/comando ignoradas na busca (pt/en)
export const STOP_WORDS = new Set([
  'por', 'pro', 'pra', 'para', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'com', 'me', 'meu', 'minha',
  'tem', 'ter', 'tinha', 'algum', 'alguma', 'algo', 'quero', 'queria', 'gostaria',
  'mostrar', 'mostra', 'ver', 'buscar', 'procurar', 'pesquisar', 'achar', 'encontrar',
  'voce', 'vc', 'ai', 'existe', 'vende', 'vendem', 'possui', 'teria', 'produto', 'produtos',
  'search', 'find', 'show', 'want', 'the', 'for', 'of', 'an', 'is', 'do', 'you', 'have',
]);

// Quebra a busca em palavras úteis (ignora ligação e palavras curtas)
export const tokenize = (query: string): string[] =>
  normalizeText(query)
    .split(/[\s,.;:!?'"()/_\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

// Pontua produtos por relevância à query (pontua por palavra → bem mais tolerante).
// Base reutilizada tanto pela busca determinística (searchProducts) quanto pelo
// filtro de catálogo relevante mandado pra IA (relevantCatalogForAI) — mesma
// lógica de match em ambos os casos, sem duplicar.
// Detecta intenção de navegar por CATEGORIA ("quais doces tem", "me mostra cosméticos")
export const CATEGORY_WORDS: Record<string, string[]> = {
  doces: ['doce', 'doces', 'snack', 'snacks', 'chocolate', 'chocolates', 'guloseima', 'salgadinho', 'candy', 'sweets', 'okashi'],
  cosmeticos: ['cosmetico', 'cosmeticos', 'cosmetic', 'skincare', 'beleza', 'maquiagem', 'creme', 'cremes', 'protetor'],
  acessorios: ['acessorio', 'acessorios', 'figura', 'figuras', 'colecionavel', 'colecionaveis', 'anime', 'figure', 'goods'],
  papelaria: ['papelaria', 'caneta', 'canetas', 'caderno', 'cadernos', 'escritorio', 'stationery'],
};
export const CATEGORY_LABEL: Record<string, string> = {
  doces: 'doces', cosmeticos: 'cosméticos', acessorios: 'acessórios', papelaria: 'papelaria',
};
export const detectCategory = (query: string): string | null => {
  const toks = tokenize(query);
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((w) => toks.includes(normalizeText(w)))) return cat;
  }
  return null;
};
