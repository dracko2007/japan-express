import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { loadRemoteCart, saveRemoteCart, registerCartFlush } from '@/services/cartSyncService';
import { mergeCarts, toRemoteCart } from '@/utils/cartMerge';
import { CartItem, Product } from '@/types';
import { safeStorage } from '@/utils/storage';
import { SESSION_END_EVENT } from '@/utils/localData';
import { effectiveYen } from '@/utils/pricing';
import { trackAddToCart } from '@/lib/analytics';
import { useProducts } from '@/context/ProductsContext';

const CART_STORAGE_KEY = 'sakura_cart';
const UNSELECTED_STORAGE_KEY = 'sakura_cart_unselected';

/** Identifica uma linha do carrinho (produto + tamanho) na lista de desmarcados. */
const lineKey = (productId: string, size: string) => `${productId}|${size}`;

const loadUnselected = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(safeStorage.getItem(UNSELECTED_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

// Limite de quantidade de um produto no carrinho: estoque real, ou sem
// limite quando o produto é ilimitado (ou não tem controle de estoque).
// Reaproveitado pelo seletor de quantidade da página do produto para manter
// o mesmo comportamento de clamping em toda a loja.
export const getMaxQty = (product: Product): number => {
  if (!product.stock || product.stock.unlimited) return Infinity;
  // Unidades que já estão em outro país também contam: o estoque do Japão pode
  // estar zerado e o produto seguir à venda para o cliente daquele país. Quem
  // decide de onde sai (e se a quantidade cabe) é o servidor.
  const local = Object.values(product.localStock || {})
    .filter((entry) => entry.enabled && entry.price > 0)
    .map((entry) => Number(entry.quantity) || 0);
  return Math.max(product.stock.quantity, ...local);
};

const loadCart = (): CartItem[] => {
  try {
    const raw = safeStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.filter((i: CartItem) => !i.freeGift); // strip stale gift items on load
  } catch {
    return [];
  }
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: string, quantity?: number, variantLabel?: string) => void;
  removeFromCart: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  /** Itens que vão ser comprados (os marcados + brindes). `items` continua sendo tudo que está no carrinho. */
  selectedItems: CartItem[];
  /** Soma em ¥ só dos itens marcados (`totalPrice` continua somando o carrinho todo). */
  selectedTotalPrice: number;
  isItemSelected: (item: CartItem) => boolean;
  toggleItemSelected: (productId: string, size: string) => void;
  setAllItemsSelected: (selected: boolean) => void;
  /** Pedido feito: tira do carrinho só o que foi comprado; o que ficou desmarcado continua lá. */
  removePurchasedItems: () => void;
  totalItems: number;
  totalPrice: number;
  getSpaceUsed: () => { small: number; large: number; totalSmallEquivalent: number };
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rawItems, setRawItems] = useState<CartItem[]>(loadCart);
  // Linhas que o cliente deixou no carrinho mas NÃO quer comprar agora. O padrão é marcado: item novo entra marcado.
  const [unselected, setUnselected] = useState<string[]>(loadUnselected);
  const { products } = useProducts();

  // Reage a armar/desarmar o resgate promocional (Cart.tsx dispara o evento) —
  // safeStorage não é reativo, então usamos um tick para re-derivar preço/brinde.
  const [promoTick, setPromoTick] = useState(0);
  useEffect(() => {
    const bump = () => setPromoTick((t) => t + 1);
    window.addEventListener('promo-pricing-changed', bump);
    return () => window.removeEventListener('promo-pricing-changed', bump);
  }, []);

  // Persist only non-gift items to localStorage
  useEffect(() => {
    safeStorage.setItem(CART_STORAGE_KEY, JSON.stringify(rawItems));
  }, [rawItems]);

  // Linha que saiu do carrinho não pode deixar "desmarcado" para trás: se o produto voltar, entra marcado.
  useEffect(() => {
    setUnselected((current) => {
      const present = new Set(rawItems.map((i) => lineKey(i.product.id, i.size)));
      const next = current.filter((key) => present.has(key));
      return next.length === current.length ? current : next;
    });
  }, [rawItems]);
  useEffect(() => {
    safeStorage.setItem(UNSELECTED_STORAGE_KEY, JSON.stringify(unselected));
  }, [unselected]);

  const unselectedSet = useMemo(() => new Set(unselected), [unselected]);
  const isItemSelected = useCallback(
    (item: CartItem) => item.freeGift === true || !unselectedSet.has(lineKey(item.product.id, item.size)),
    [unselectedSet],
  );
  // Brindes dependem do que vai ser COMPRADO: item desmarcado não gera brinde.
  const purchaseRawItems = useMemo(() => rawItems.filter(isItemSelected), [rawItems, isItemSelected]);

  // ── Carrinho por conta (Firestore `carts/{uid}`) ─────────────────────────────────────────────
  // Quem está logado tem o carrinho guardado na conta: sair e entrar de novo (ou entrar em outro aparelho)
  // devolve os itens. Quem não está logado continua só com o localStorage.
  const [syncUid, setSyncUid] = useState<string | null>(null);
  // Só grava depois de ler a nuvem e mesclar: senão um carrinho vazio deste aparelho apagaria o da conta.
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const latest = useRef({ rawItems, unselected });
  latest.current = { rawItems, unselected };

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (firebaseUser) => {
      // Admin usa conta interna (`admin_*`) e não tem carrinho de compras.
      const uid = firebaseUser && !firebaseUser.isAnonymous && !firebaseUser.uid.startsWith('admin_') ? firebaseUser.uid : null;
      setSyncUid(uid);
      if (!uid) setHydratedUid(null);
    });
  }, []);

  useEffect(() => {
    if (!syncUid || hydratedUid === syncUid || !products.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await loadRemoteCart(syncUid);
        if (cancelled) return;
        const merged = mergeCarts(latest.current.rawItems, latest.current.unselected, remote, products, getMaxQty);
        setRawItems(merged.items);
        setUnselected(merged.unselected);
        setHydratedUid(syncUid);
      } catch (error) {
        // Sem ler a nuvem NÃO grava (não risca sobrescrever o carrinho da conta): segue só com o aparelho.
        if (import.meta.env.DEV) console.warn('[cart-sync] não consegui ler o carrinho da conta:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [syncUid, hydratedUid, products]);

  useEffect(() => {
    if (!syncUid || hydratedUid !== syncUid) return;
    const timer = window.setTimeout(() => {
      void saveRemoteCart(syncUid, toRemoteCart(rawItems, unselected)).catch((error) => {
        if (import.meta.env.DEV) console.warn('[cart-sync] não consegui gravar o carrinho:', error);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [rawItems, unselected, syncUid, hydratedUid]);

  // Quem vai sair da conta chama isto antes: grava já a última alteração, sem esperar o atraso.
  useEffect(() => registerCartFlush(async () => {
    if (!syncUid || hydratedUid !== syncUid) return;
    await saveRemoteCart(syncUid, toRemoteCart(latest.current.rawItems, latest.current.unselected));
  }), [syncUid, hydratedUid]);

  // Gift items are fully derived — no state, no loops
  const giftItems = useMemo<CartItem[]>(() => {
    if (!products.length) return [];
    const totalYen = purchaseRawItems.reduce((s, i) => s + effectiveYen(i.product, i.size) * i.quantity, 0);
    const gifts: CartItem[] = [];
    const addedGiftIds = new Set<string>();
    for (const item of purchaseRawItems) {
      const pg = item.product.promoGift;
      if (!pg || pg.buyQuantity <= 0 || !pg.giftProductId) continue;
      if (item.quantity < pg.buyQuantity) continue;
      if (pg.minOrderValueYen && totalYen < pg.minOrderValueYen) continue;
      if (addedGiftIds.has(pg.giftProductId)) continue;
      const giftProduct = products.find(p => p.id === pg.giftProductId);
      if (!giftProduct) continue;
      addedGiftIds.add(pg.giftProductId);
      gifts.push({
        product: giftProduct,
        size: 'small',
        quantity: 1,
        variantLabel: 'Presente 🎁',
        freeGift: true,
        freeGiftFromProductId: item.product.id,
      });
    }
    // Brinde de campanha promocional (BOGO via link de e-mail ?promo=CODE):
    // quando o produto qualificante está no carrinho, adiciona o presente grátis.
    try {
      const raw = safeStorage.getItem('pending_promo_gift');
      if (raw) {
        const g = JSON.parse(raw);
        if (g && g.productId && purchaseRawItems.some(i => i.product.id === g.productId)) {
          const giftId = g.giftProductId || g.productId;
          if (!addedGiftIds.has(giftId)) {
            const giftProduct = products.find(p => p.id === giftId);
            if (giftProduct) {
              addedGiftIds.add(giftId);
              gifts.push({
                product: giftProduct,
                size: 'small',
                quantity: 1,
                variantLabel: 'Presente da promoção 🎁',
                freeGift: true,
                freeGiftFromProductId: g.productId,
              });
            }
          }
        }
      }
    } catch { /* JSON inválido — ignora */ }
    return gifts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseRawItems, products, promoTick]);

  // Campanha promocional com "manter desconto inicial" DESMARCADO: o produto
  // qualificante volta ao preço ORIGINAL (discountPercent zerado) enquanto o
  // resgate está armado — evita empilhar o desconto da página com o da oferta.
  const adjustedItems = useMemo<CartItem[]>(() => {
    try {
      const raw = safeStorage.getItem('promo_full_price');
      if (!raw) return rawItems;
      const flag = JSON.parse(raw);
      if (!flag || !flag.productId) return rawItems;
      return rawItems.map((i) =>
        i.product.id === flag.productId && (i.product.discountPercent || 0) > 0
          ? { ...i, product: { ...i.product, discountPercent: 0 } }
          : i
      );
    } catch {
      return rawItems;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawItems, promoTick]);

  // All items exposed to consumers = regular + auto-gifts
  const items = useMemo(() => [...adjustedItems, ...giftItems], [adjustedItems, giftItems]);
  // O que vai ser comprado: marcados + brindes (que só existem para os marcados).
  const selectedItems = useMemo(() => [...adjustedItems.filter(isItemSelected), ...giftItems], [adjustedItems, giftItems, isItemSelected]);

  const addToCart = useCallback((product: Product, size: string, quantity = 1, variantLabel?: string) => {
    setRawItems(prev => {
      const maxQty = getMaxQty(product);
      const existingIndex = prev.findIndex(
        item => item.product.id === product.id && item.size === size
      );
      if (existingIndex >= 0) {
        const newQty = Math.min(prev[existingIndex].quantity + quantity, maxQty);
        if (newQty === prev[existingIndex].quantity) return prev;
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      const newQty = Math.min(quantity, maxQty);
      if (newQty <= 0) return prev;
      return [...prev, { product, size, quantity: newQty, variantLabel }];
    });
    // Fora do updater de estado (que o React pode invocar mais de uma vez) —
    // dispara o evento uma única vez por chamada de addToCart.
    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      item_category: product.category,
      quantity,
      price: effectiveYen(product, size),
    }, 'JPY');
  }, []);

  const removeFromCart = useCallback((productId: string, size: string) => {
    setRawItems(prev => prev.filter(
      item => !(item.product.id === productId && item.size === size)
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      setRawItems(prev => prev.filter(
        item => !(item.product.id === productId && item.size === size)
      ));
      return;
    }
    setRawItems(prev => prev.map(item => {
      if (item.product.id !== productId || item.size !== size) return item;
      const maxQty = getMaxQty(item.product);
      return { ...item, quantity: Math.min(quantity, maxQty) };
    }));
  }, []);

  const clearCart = useCallback(() => {
    setRawItems([]);
  }, []);

  const toggleItemSelected = useCallback((productId: string, size: string) => {
    const key = lineKey(productId, size);
    setUnselected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }, []);

  const setAllItemsSelected = useCallback((selected: boolean) => {
    setUnselected(selected ? [] : rawItems.map((i) => lineKey(i.product.id, i.size)));
  }, [rawItems]);

  const removePurchasedItems = useCallback(() => {
    setRawItems((prev) => prev.filter((item) => unselectedSet.has(lineKey(item.product.id, item.size))));
  }, [unselectedSet]);

  // Limpa o carrinho quando o usuário faz logout (evento disparado pelo UserContext)
  useEffect(() => {
    // Sair da conta limpa este aparelho (computador compartilhado), mas NUNCA grava o carrinho vazio na conta:
    // `hydratedUid` volta a null na mesma atualização, e o efeito de gravação só roda hidratado.
    const onLogout = () => { setHydratedUid(null); setRawItems([]); };
    window.addEventListener(SESSION_END_EVENT, onLogout);
    return () => window.removeEventListener(SESSION_END_EVENT, onLogout);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  // Price excludes free gifts (usa itens ajustados p/ refletir o preço original da promo)
  const totalPrice = useMemo(
    () => adjustedItems.reduce((sum, item) => sum + effectiveYen(item.product, item.size) * item.quantity, 0),
    [adjustedItems]
  );
  const selectedTotalPrice = useMemo(
    () => adjustedItems.filter(isItemSelected).reduce((sum, item) => sum + effectiveYen(item.product, item.size) * item.quantity, 0),
    [adjustedItems, isItemSelected]
  );

  const getSpaceUsed = useCallback(() => {
    let small = 0;
    let large = 0;
    selectedItems.forEach(item => {
      if (item.size === 'small') small += item.quantity;
      else large += item.quantity;
    });
    return { small, large, totalSmallEquivalent: small + large * 2 };
  }, [selectedItems]);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      selectedItems,
      selectedTotalPrice,
      isItemSelected,
      toggleItemSelected,
      setAllItemsSelected,
      removePurchasedItems,
      totalItems,
      totalPrice,
      getSpaceUsed
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
