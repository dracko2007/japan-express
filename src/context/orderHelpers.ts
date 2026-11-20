import type { Order } from '@/context/userTypes';

/**
 * Pedido como vem do localStorage ou do Firestore: o app gravou pedidos em formatos diferentes ao longo do
 * tempo (`orderDate`/`date`, `totalAmount`/`totalPrice`/`total`, `name`/`productName`...), então todos os campos
 * são opcionais e `normalizeStoredOrder` entrega o formato atual (`Order`).
 */
export interface StoredOrder extends Omit<Partial<Order>, 'items'> {
  syncedAt?: string;
  totalPrice?: number | string;
  total?: number | string;
  shippingCost?: number | string;
  shippingCarrier?: string;
  name?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  building?: string;
  items?: Array<{
    productName?: string;
    name?: string;
    productId?: string;
    size?: string;
    quantity?: number | string;
    price?: number | string;
    unitYen?: number;
    freeGift?: boolean;
  }>;
  [key: string]: unknown;
}

/** O que `fixTrackingUrl` lê e reescreve: rastreio e transportadora. */
interface TrackedOrder {
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shipping?: { carrier?: string };
}

export const normalizeStoredOrder = (order: StoredOrder | null | undefined): Order | null => {
  if (!order) return null;
  const statusText = String(order.status || '').toLowerCase();
  const status =
    statusText.includes('cancel') ? 'cancelled'
    : statusText.includes('deliv') || statusText.includes('entreg') ? 'delivered'
    : statusText.includes('ship') || statusText.includes('trans') ? 'shipped'
    : statusText.includes('confirm') || statusText.includes('pago') ? 'confirmed'
    : 'pending';

  return {
    ...order,
    id: order.id || order.orderNumber || `order-${Date.now()}`,
    orderNumber: order.orderNumber || order.id,
    date: order.orderDate || order.date || order.syncedAt || new Date().toISOString(),
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          productName: item.productName || item.name || item.productId || 'Produto',
          size: item.size || '',
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
        }))
      : [],
    totalAmount: Number(order.totalAmount ?? order.totalPrice ?? order.total ?? 0),
    paymentMethod: order.paymentMethod || '',
    status,
    shipping: order.shipping || {
      cost: Number(order.shippingCost) || 0,
      carrier: order.shippingCarrier || '',
    },
    shippingAddress: order.shippingAddress || {
      name: order.name || '',
      postalCode: order.postalCode || '',
      prefecture: order.prefecture || '',
      city: order.city || '',
      address: order.address || '',
      building: order.building || '',
    },
  };
};

// Helper: fix old tracking URLs to use the correct format (direct results)
export const fixTrackingUrl = <T extends TrackedOrder>(order: T): T => {
  const trackingNumber = order.trackingNumber;
  const savedUrl = order.trackingUrl || '';
  let carrier = order.carrier || order.shipping?.carrier || '';
  
  // Detect carrier from saved URL if carrier field is empty
  if (!carrier && savedUrl) {
    if (savedUrl.includes('kuronekoyamato')) carrier = 'Yamato';
    else if (savedUrl.includes('sagawa')) carrier = 'Sagawa';
    else if (savedUrl.includes('japanpost')) carrier = 'Japan Post';
    else if (savedUrl.includes('fukutsu')) carrier = 'Fukutsu';
  }
  
  if (!trackingNumber || !carrier) return order;
  
  const lc = carrier.toLowerCase();
  let newUrl = '';
  if (lc.includes('yamato') || lc.includes('クロネコ')) {
    newUrl = `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${trackingNumber}`;
  } else if (lc.includes('sagawa') || lc.includes('佐川')) {
    newUrl = `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
  } else if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) {
    newUrl = `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${trackingNumber}&locale=ja`;
  } else if (lc.includes('fukutsu') || lc.includes('福通')) {
    newUrl = `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${trackingNumber}`;
  }
  
  if (newUrl) {
    return { ...order, trackingUrl: newUrl, carrier: carrier };
  }
  return order;
};

// Merge local + Firestore orders (deduplicate by orderNumber, Firestore takes priority)
export const mergeOrders = (local: Order[], firestore: Order[]): Order[] => {
  const map = new Map<string, Order>();
  // Firestore orders first (source of truth, includes tracking data)
  firestore.forEach(o => map.set(o.orderNumber, o));
  // Local orders: merge but keep Firestore tracking fields if they exist
  local.forEach(o => {
    if (!map.has(o.orderNumber)) {
      map.set(o.orderNumber, fixTrackingUrl(o));
    } else {
      // Firestore already has this order — keep Firestore version (has tracking data)
      const existing = map.get(o.orderNumber)!;
      map.set(o.orderNumber, fixTrackingUrl({ ...o, ...existing }));
    }
  });
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
};
