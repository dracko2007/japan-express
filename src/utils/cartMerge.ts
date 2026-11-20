import type { CartItem, Product } from '@/types';

/** Uma linha do carrinho como fica guardada na nuvem: só o que identifica o item, nunca preço nem o produto inteiro. */
export interface RemoteCartItem {
  productId: string;
  size: string;
  quantity: number;
  variantLabel?: string;
}

export interface RemoteCart {
  items: RemoteCartItem[];
  /** Linhas (`produto|tamanho`) que o cliente deixou no carrinho mas não quer comprar agora. */
  unselected: string[];
}

export const lineKey = (productId: string, size: string): string => `${productId}|${size}`;

/** O que sobe para a nuvem: preço e dados do produto vêm do catálogo na hora de ler, para nunca ficarem velhos. */
export function toRemoteCart(items: CartItem[], unselected: string[]): RemoteCart {
  return {
    items: items
      .filter((i) => !i.freeGift)
      .map((i) => ({
        productId: i.product.id,
        size: i.size,
        quantity: i.quantity,
        ...(i.variantLabel ? { variantLabel: i.variantLabel } : {}),
      })),
    unselected,
  };
}

/**
 * Junta o carrinho deste aparelho com o da conta (nuvem), sem perder nada de nenhum lado:
 *  - mesma linha nos dois: vale a MAIOR quantidade (não soma: o aparelho pode ser cópia da nuvem);
 *  - linha só de um lado: entra;
 *  - produto que saiu do catálogo: sai;
 *  - quantidade nunca passa do estoque (`maxQty`).
 * A ordem é a do aparelho, com as linhas só da nuvem no fim.
 */
export function mergeCarts(
  local: CartItem[],
  localUnselected: string[],
  remote: RemoteCart | null,
  catalog: Product[],
  maxQty: (product: Product) => number,
): { items: CartItem[]; unselected: string[] } {
  const merged = new Map<string, CartItem>();
  for (const item of local) {
    if (item.freeGift) continue;
    merged.set(lineKey(item.product.id, item.size), item);
  }

  for (const line of remote?.items ?? []) {
    const product = catalog.find((p) => p.id === line.productId);
    if (!product || !(line.quantity > 0)) continue;
    const key = lineKey(line.productId, line.size);
    const existing = merged.get(key);
    const limit = maxQty(product);
    if (existing) {
      const quantity = Math.min(Math.max(existing.quantity, line.quantity), limit);
      if (quantity > 0) merged.set(key, { ...existing, quantity });
    } else {
      const quantity = Math.min(Math.floor(line.quantity), limit);
      if (quantity > 0) merged.set(key, { product, size: line.size, quantity, variantLabel: line.variantLabel });
    }
  }

  const unselected = [...new Set([...localUnselected, ...(remote?.unselected ?? [])])].filter((key) => merged.has(key));
  return { items: [...merged.values()], unselected };
}
