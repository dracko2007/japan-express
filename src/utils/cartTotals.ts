interface CartLine {
  freeGift?: boolean;
  quantity: number;
}

interface CartSubtotalOptions<T> {
  /** Item da promoção da home (id `_promo`): cupom nenhum vale nele. */
  isPromo: (item: T) => boolean;
  /** Produto com desconto da loja: também fica fora da base do cupom. */
  isStoreDiscounted: (item: T) => boolean;
  /** Preço unitário na moeda exibida. */
  unit: (item: T) => number;
}

/**
 * Subtotais do carrinho, na moeda exibida. O TOTAL tem sempre todos os itens (menos brindes): o que muda por
 * categoria é só a base do cupom, que exclui promoção da home e produto com desconto da loja
 * (`regularSubtotal`). Misturar as duas coisas fez o total do carrinho sumir com os produtos em promoção.
 */
export function cartSubtotals<T extends CartLine>(items: T[], { isPromo, isStoreDiscounted, unit }: CartSubtotalOptions<T>) {
  let promoSubtotal = 0;
  let storeDiscountedSubtotal = 0;
  let regularSubtotal = 0;
  for (const item of items) {
    if (item.freeGift) continue;
    const line = unit(item) * item.quantity;
    if (isPromo(item)) promoSubtotal += line;
    else if (isStoreDiscounted(item)) storeDiscountedSubtotal += line;
    else regularSubtotal += line;
  }
  return {
    promoSubtotal,
    storeDiscountedSubtotal,
    /** Itens que podem receber cupom: sem promoção da home e sem desconto da loja. */
    regularSubtotal,
    /** Tudo que o cliente vai pagar pelos produtos, antes de cupom e pontos. */
    baseTotalPrice: promoSubtotal + storeDiscountedSubtotal + regularSubtotal,
  };
}
