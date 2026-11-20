import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { lineKey, type RemoteCart, type RemoteCartItem } from '@/utils/cartMerge';

/**
 * Carrinho por conta: Firestore `carts/{uid}` — o carrinho sobrevive a sair da conta e aparece em
 * qualquer aparelho. O localStorage continua sendo o carrinho de quem não está logado e a cópia da
 * sessão atual. Mesmo desenho da lista de desejos (`wishlistService`): só o dono lê e grava.
 */
const COLLECTION = 'carts';
/** Mesmo teto do `firestore.rules`. */
const MAX_LINES = 60;

const devWarn = import.meta.env.DEV ? console.warn.bind(console) : () => {};

function isLine(value: unknown): value is RemoteCartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.productId === 'string' && v.productId !== ''
    && typeof v.size === 'string' && v.size !== ''
    && typeof v.quantity === 'number' && Number.isFinite(v.quantity) && v.quantity > 0
    && (v.variantLabel === undefined || typeof v.variantLabel === 'string');
}

/** Só mexe na nuvem com a sessão do Firebase do PRÓPRIO usuário. */
const cloudReady = (uid: string): boolean => !!db && auth?.currentUser?.uid === uid;

export async function loadRemoteCart(uid: string): Promise<RemoteCart | null> {
  if (!db || !cloudReady(uid)) return null;
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { items?: unknown; unselected?: unknown };
  return {
    items: Array.isArray(data.items) ? data.items.filter(isLine) : [],
    unselected: Array.isArray(data.unselected) ? data.unselected.filter((k): k is string => typeof k === 'string') : [],
  };
}

export async function saveRemoteCart(uid: string, cart: RemoteCart): Promise<void> {
  if (!db || !cloudReady(uid)) return;
  const items = cart.items.slice(0, MAX_LINES);
  const present = new Set(items.map((i) => lineKey(i.productId, i.size)));
  const unselected = cart.unselected.filter((k) => present.has(k)).slice(0, MAX_LINES);
  await setDoc(doc(db, COLLECTION, uid), { items, unselected, updatedAt: serverTimestamp() });
}

// ── gravação pendente ────────────────────────────────────────────────────────
// O carrinho grava com um pequeno atraso (muitos cliques em +/- viram uma gravação). Quem vai encerrar
// a sessão chama `flushCartSync()` ANTES de sair, para a última alteração não ficar para trás.
let flusher: (() => Promise<void>) | null = null;

export function registerCartFlush(fn: () => Promise<void>): () => void {
  flusher = fn;
  return () => { if (flusher === fn) flusher = null; };
}

export async function flushCartSync(): Promise<void> {
  try {
    await flusher?.();
  } catch (error) {
    devWarn('[cart-sync] não consegui gravar antes de sair:', error);
  }
}
