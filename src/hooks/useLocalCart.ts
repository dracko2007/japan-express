import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import type { CartItem } from '@/types';
import { localOffer, shipAllFromJapan, splitCart } from '@/utils/localStock';

const keyOf = (item: CartItem) => `${item.product.id}|${item.size}`;

/**
 * Como o que vai ser COMPRADO (itens marcados) se divide entre itens que já estão no país do cliente
 * e itens que vêm do Japão, e qual preço cada linha mostra. Item desmarcado não entra na decisão do
 * pedido, mas mostra o preço que teria se fosse comprado junto com os demais.
 */
export function useLocalCart() {
  const { items: allItems, selectedItems: items, isItemSelected } = useCart();
  const { selectedCountry } = useLanguage();
  const [forcedJapan, setForcedJapan] = useState(shipAllFromJapan);
  useEffect(() => {
    const sync = () => setForcedJapan(shipAllFromJapan());
    window.addEventListener('fulfillment-changed', sync);
    return () => window.removeEventListener('fulfillment-changed', sync);
  }, []);

  return useMemo(() => {
    const split = splitCart(items, selectedCountry);
    const localKeys = new Set(forcedJapan ? [] : split.localItems.map(keyOf));
    // Linha desmarcada: usa a divisão do carrinho todo só para mostrar o preço dela.
    const displayKeys = items.length === allItems.length
      ? localKeys
      : new Set(forcedJapan ? [] : splitCart(allItems, selectedCountry).localItems.map(keyOf));
    /** Preço fixo local da linha, ou null quando vale a conta do Japão. */
    const localPrice = (item: CartItem): number | null => {
      const keys = isItemSelected(item) ? localKeys : displayKeys;
      return keys.has(keyOf(item)) ? localOffer(item.product, selectedCountry)?.price ?? null : null;
    };
    return {
      split,
      forcedJapan,
      localPrice,
      /** Todo o carrinho sai do país do cliente (e ele não pediu envio único do Japão). */
      localOrder: split.kind === 'local' && !forcedJapan,
      /** Algum item sai do país do cliente (pedido todo de lá ou misto): a referência em ¥ não vale. */
      anyLocal: split.kind !== 'japan' && !forcedJapan,
      country: selectedCountry,
    };
  }, [items, allItems, isItemSelected, selectedCountry, forcedJapan]);
}
