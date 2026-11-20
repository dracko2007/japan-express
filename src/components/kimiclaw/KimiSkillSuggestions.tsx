import React from 'react';
import { Command, Smartphone } from 'lucide-react';

interface KimiSkillSuggestionsProps {
  isTyping: boolean;
  isAdmin: boolean;
  language: "pt" | "en" | "ja";
  handleSuggestionClick: (skillText: string, searchKey: string, { agent }?: { agent?: boolean; }) => void;
  t: (key: string) => string;
}

const KimiSkillSuggestions: React.FC<KimiSkillSuggestionsProps> = ({
  isTyping,
  isAdmin,
  language,
  handleSuggestionClick,
  t,
}) => {
  return (
    <>
    {/* SKILL SUGGESTIONS */}
    {!isTyping && (
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Command className="w-3 h-3" />
          {isAdmin
            ? (language === 'pt' ? '⚡ Modo Admin' : '⚡ Admin Mode')
            : (language === 'pt' ? 'Habilidades Rápidas' : 'Quick Agent Skills')}
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto scrollbar-hide py-0.5">
          <button
            onClick={() => handleSuggestionClick(t('kimiclaw.skill.search_products'), 'buscar produtos')}
            className="text-[11px] bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-2.5 py-1 text-primary-dark dark:text-primary font-bold flex items-center gap-1 transition duration-200"
          >
            🔍 {language === 'pt' ? 'Buscar Produtos' : 'Search Products'}
          </button>
          {isAdmin ? (
            <>
              <button
                onClick={() => handleSuggestionClick('Qual o faturamento desse mês?', 'faturamento', { agent: true })}
                className="text-[11px] bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-full px-2.5 py-1 text-green-700 dark:text-green-400 font-bold flex items-center gap-1 transition duration-200"
              >
                📊 {language === 'pt' ? 'Faturamento' : 'Revenue'}
              </button>
              <button
                onClick={() => handleSuggestionClick('Calcular frete do biore para Brasil', 'frete biore brasil', { agent: true })}
                className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1 text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 transition duration-200"
              >
                ⚖️ {language === 'pt' ? 'Frete por Produto' : 'Product Shipping'}
              </button>
              <button
                onClick={() => handleSuggestionClick('Mostrar os produtos ocultos', 'mostrar produtos ocultos', { agent: true })}
                className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1 text-amber-700 dark:text-amber-400 font-medium transition duration-200"
              >
                👁️ {language === 'pt' ? 'Ver Catálogo Completo' : 'Full Catalog'}
              </button>
              <button
                onClick={() => handleSuggestionClick('Quais produtos têm a menor margem? Mostre custo e margem.', 'margem lucro produto', { agent: true })}
                className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1 text-amber-700 dark:text-amber-400 font-medium transition duration-200"
              >
                📊 {language === 'pt' ? 'Margem/Custo' : 'Margin/Cost'}
              </button>
              <button
                onClick={() => handleSuggestionClick(t('kimiclaw.skill.calc_shipping'), 'calcular frete')}
                className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground transition duration-200"
              >
                📦 {language === 'pt' ? 'Frete Manual' : 'Manual Shipping'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleSuggestionClick(t('kimiclaw.skill.calc_shipping'), 'calcular frete')}
                className="text-[11px] bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-2.5 py-1 text-primary-dark dark:text-primary font-bold flex items-center gap-1 transition duration-200"
              >
                📦 {language === 'pt' ? 'Calcular Frete' : 'Calc. Shipping'}
              </button>
              <button
                onClick={() => handleSuggestionClick(t('kimiclaw.skill.apply_coupon'), 'cupom')}
                className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground transition duration-200"
              >
                {t('kimiclaw.skill.apply_coupon')}
              </button>
              <button
                onClick={() => handleSuggestionClick(language === 'pt' ? 'Como funciona o programa de afiliados? Quanto eu ganho?' : language === 'ja' ? 'アフィリエイトプログラムの仕組みと報酬を教えてください' : 'How does the affiliate program work? How much do I earn?', 'programa de afiliados', { agent: true })}
                className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground transition duration-200"
              >
                🤝 {language === 'pt' ? 'Afiliados' : language === 'ja' ? 'パートナー' : 'Affiliates'}
              </button>
              <button
                onClick={() => handleSuggestionClick('📱 Receber novidades no WhatsApp', 'enviar whatsapp')}
                className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground flex items-center gap-1 transition duration-200"
              >
                <Smartphone className="w-3 h-3" />
                {language === 'pt' ? 'WhatsApp' : 'WhatsApp'}
              </button>
            </>
          )}
          <button
            onClick={() => handleSuggestionClick(t('kimiclaw.skill.clear_cart'), 'limpar carrinho')}
            className="text-[11px] bg-card hover:bg-destructive/10 border border-border hover:border-destructive/30 rounded-full px-2.5 py-1 text-destructive font-medium transition duration-200"
          >
            {t('kimiclaw.skill.clear_cart')}
          </button>
        </div>
      </div>
    )}

    </>
  );
};

export default KimiSkillSuggestions;
