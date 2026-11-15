// Programa de parcerias (afiliados e divulgadores/influencers) explicado pelo
// assistente virtual. UMA fonte para o chat (regra local, pt/en/ja) e para a IA
// (prompt do servidor): os níveis e metas vêm daqui, e `affiliateService.ts`
// (TIER_CONFIG) usa os mesmos números — um teste confere.

/** Níveis padrão do afiliado. `aboveYen`: lucro do mês acima do qual o nível vale. */
export const AFFILIATE_TIERS = {
  bronze: { percent: 10, aboveYen: 0 },
  silver: { percent: 15, aboveYen: 100_000 },
  gold: { percent: 20, aboveYen: 200_000 },
};

const yen = (value, lang) => `¥${value.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}`;

/** Palavras que indicam pergunta sobre o programa (já sem acento e em minúsculas). */
export const PARTNERSHIP_KEYWORDS = /afiliad|divulgador|influenc|embaixador|parceria|comiss(ao|oes)|ganhar dinheiro|affiliate|promoter|ambassador|commission|referral|アフィリエイト|インフルエンサー|紹介/;

/** Exemplos prontos (a IA copia estes valores; nunca faz a conta por conta própria). */
export function partnershipExamples(lang = 'pt') {
  const { bronze, silver, gold } = AFFILIATE_TIERS;
  const sale = 5_000;
  const part = (tier) => yen(Math.round(sale * tier.percent / 100), lang);
  const mid = 150_000;
  const top = 250_000;
  if (lang === 'en') {
    return `Example per sale: on a sale with ${yen(sale, lang)} of profit on the products, Bronze earns ${part(bronze)}, Silver ${part(silver)} and Gold ${part(gold)}.
Example per month: generating ${yen(mid, lang)} of profit in a month is above ${yen(silver.aboveYen, lang)}, so the next month starts at Silver (${silver.percent}%); ${yen(top, lang)} is above ${yen(gold.aboveYen, lang)}, so it starts at Gold (${gold.percent}%).`;
  }
  if (lang === 'ja') {
    return `1件あたりの例：商品の利益が${yen(sale, lang)}の注文では、ブロンズは${part(bronze)}、シルバーは${part(silver)}、ゴールドは${part(gold)}です。
月間の例：月の利益が${yen(mid, lang)}なら${yen(silver.aboveYen, lang)}を超えるため、翌月はシルバー（${silver.percent}%）から始まります。${yen(top, lang)}なら${yen(gold.aboveYen, lang)}を超えるため、ゴールド（${gold.percent}%）から始まります。`;
  }
  return `Exemplo por venda: numa venda com ${yen(sale, lang)} de lucro nos produtos, o Bronze recebe ${part(bronze)}, a Prata ${part(silver)} e o Ouro ${part(gold)}.
Exemplo no mês: gerar ${yen(mid, lang)} de lucro no mês passa de ${yen(silver.aboveYen, lang)}, então o mês seguinte começa na Prata (${silver.percent}%); com ${yen(top, lang)}, acima de ${yen(gold.aboveYen, lang)}, começa no Ouro (${gold.percent}%).`;
}

export function partnershipAnswer(lang = 'pt') {
  const { bronze, silver, gold } = AFFILIATE_TIERS;
  if (lang === 'en') {
    return `**Japan Express partnership program** 🤝

**Affiliate / influencer** — earns a commission on every sale made with their code or link. Shoppers using the code get its discount (it doesn't apply to items already on promotion).
• How to join: open the **"Afilie-se" page (/afiliado)** and tap "Quero me afiliar" (or use My Profile); the team reviews and approves.
• Commission: a % of the net profit of the products in each sale (no shipping or Personal Shopper fee), released after delivery is confirmed.
• Levels: 🥉 Bronze ${bronze.percent}% · 🥈 Silver ${silver.percent}% (monthly profit above ${yen(silver.aboveYen, 'en')}) · 🥇 Gold ${gold.percent}% (above ${yen(gold.aboveYen, 'en')}). The month closes on its last day and the level reached sets the % for the next month.

**Promoter** — the store sends you a free product and you promote it with your own code and link per product/video. There is no commission: results are measured by visits and purchases per code. Each account can use a code once. Joining is by invitation from the store.

You follow everything in the **/afiliado** panel. The levels above are the default and may vary per partner.`;
  }
  if (lang === 'ja') {
    return `**Japan Express パートナープログラム** 🤝

**アフィリエイト／インフルエンサー** — あなたのコードまたはリンクで売れた商品ごとにコミッションを獲得できます。コードを使った購入者にはそのコードの割引が付きます（すでにセール中の商品には適用されません）。
• 参加方法：**「Afilie-se」ページ（/afiliado）**で「Quero me afiliar」を押す（またはマイページから）。スタッフが審査・承認します。
• コミッション：各注文の商品の純利益に対する％（送料・パーソナルショッパー手数料は除く）。配送完了の確認後に確定します。
• レベル：🥉 ブロンズ ${bronze.percent}% ・ 🥈 シルバー ${silver.percent}%（月間利益が${yen(silver.aboveYen, 'en')}超）・ 🥇 ゴールド ${gold.percent}%（${yen(gold.aboveYen, 'en')}超）。月末に締め、そのレベルが翌月の％になります。

**プロモーター** — お店が商品を無料でお送りし、商品／動画ごとの専用コードとリンクで紹介します。コミッションはなく、コードごとの訪問数と購入数で成果を測ります。1アカウントにつき各コードは1回のみ使えます。参加はお店からの招待制です。

すべて**/afiliado**パネルで確認できます。上記はデフォルトで、パートナーごとに異なる場合があります。`;
  }
  return `**Programa de parcerias da Japan Express** 🤝

**Afiliado / influencer** — ganha comissão por cada venda feita com o seu código ou link. Quem compra com o código recebe o desconto dele (que não vale em item que já está em promoção).
• Como entrar: na página **Afilie-se (/afiliado)**, toque em "Quero me afiliar" (ou use o Meu Perfil); a equipe analisa e aprova.
• Comissão: uma % do lucro líquido dos produtos de cada venda (sem frete nem taxa do Personal Shopper), liberada depois que a entrega é confirmada.
• Níveis: 🥉 Bronze ${bronze.percent}% · 🥈 Prata ${silver.percent}% (lucro do mês acima de ${yen(silver.aboveYen, 'pt')}) · 🥇 Ouro ${gold.percent}% (acima de ${yen(gold.aboveYen, 'pt')}). O mês fecha no último dia e o nível alcançado define a % do mês seguinte.

**Divulgador** — a loja envia um produto grátis e você divulga com um código e um link próprios por produto/vídeo. Não há comissão: o retorno é medido por visitas e compras de cada código. Cada conta usa cada código uma vez. A entrada é por convite da loja.

O acompanhamento fica no painel **/afiliado**. Os níveis acima são o padrão e podem variar por parceiro.`;
}

/** Bloco para o prompt da IA: a mesma explicação, com a regra de uso. */
export function partnershipPromptBlock() {
  return `PARCERIAS (afiliados e divulgadores/influencers) É assunto da loja. Explique SÓ com o texto abaixo, sem inventar
condições, e sem prometer ganhos. Estes valores (% e ¥) podem ser citados exatamente como estão. Adesão: página Afilie-se (/afiliado) ou Meu Perfil.
Quando perguntarem quanto ganham, qual a porcentagem ou pedirem exemplo: responda com os EXEMPLOS abaixo, copiando os
valores exatamente. NÃO crie outros valores nem faça contas por conta própria; se o caso do cliente não estiver nos exemplos,
explique a regra e diga que o painel /afiliado mostra os números reais dele.
---
${partnershipAnswer('pt')}

${partnershipExamples('pt')}
---`;
}
