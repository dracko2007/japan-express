import React from 'react';
import { ShoppingBag, Package, Tag, Truck, FileText, RotateCcw } from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import OrderItemReviewAction from '@/components/profile/OrderItemReviewAction';
import ChangeToCard from '@/components/checkout/ChangeToCard';
import { Button } from '@/components/ui/button';
import { UserProfile, Order } from '@/context/UserContext';
import { NavigateFunction } from 'react-router-dom';

interface ProfileOrderHistoryProps {
  t: (key: string) => string;
  ordersOffline: boolean;
  refreshOrders: () => Promise<void>;
  orders: Order[];
  handleConfirmReceived: (orderNumber: string) => Promise<void>;
  confirmingOrderId: string;
  findProductId: (item: { productId?: string; productName: string; }) => string;
  user: UserProfile;
  reviewBump: number;
  setReviewTarget: (value: React.SetStateAction<{ id: string; name: string; }>) => void;
  handleReorder: (order: Order) => void;
  ordersHasMore: boolean;
  loadMoreOrders: () => Promise<void>;
  ordersLoadingMore: boolean;
  navigate: NavigateFunction;
}

const ProfileOrderHistory: React.FC<ProfileOrderHistoryProps> = ({
  t,
  ordersOffline,
  refreshOrders,
  orders,
  handleConfirmReceived,
  confirmingOrderId,
  findProductId,
  user,
  reviewBump,
  setReviewTarget,
  handleReorder,
  ordersHasMore,
  loadMoreOrders,
  ordersLoadingMore,
  navigate,
}) => {
  return (
    <>
    {/* Purchase History */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {t('profile.orders.title')}
          </h2>
        </div>
      </div>

      {/* Sem isto, uma falha ao ler os pedidos no servidor deixava a
          lista vazia sem explicação — e pedido pago sumindo da tela
          parece pedido perdido. */}
      {ordersOffline && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
          <p className="font-semibold text-amber-800">Não conseguimos carregar seus pedidos do servidor</p>
          <p className="text-sm text-amber-700/90 mt-1">
            O que aparece abaixo está salvo neste navegador e pode estar
            incompleto ou desatualizado. Seus pedidos <strong>não foram perdidos</strong> —
            tente recarregar a página em instantes.
          </p>
          <button
            onClick={() => { void refreshOrders(); }}
            className="mt-3 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            // Pago = admin confirmou (paymentConfirmed) OU status já avançou além de pending.
            // Se o pedido está em confirmed/packing/shipped/delivered, o pagamento já foi recebido.
            const advancedStatuses = ['confirmed', 'processing', 'packing', 'shipped', 'delivered'];
            const isPaid = !!(order as any).paymentConfirmed || advancedStatuses.includes(order.status as string);
            return (
            <div
              key={order.id}
              className="p-4 rounded-xl border border-border hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-foreground font-mono">
                    {order.orderNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-foreground">
                    {(order as any).grandTotalYen && (order as any).currency !== 'JPY'
                      ? `${formatPrice(order.totalAmount, (order as any).currency || 'BRL', true)} (¥ ${((order as any).grandTotalYen as number).toLocaleString()})`
                      : formatPrice(order.totalAmount, (order as any).currency || 'JPY')}
                  </p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                    (order.status as string) === 'packing' ? 'bg-pink-100 text-orange-800' :
                    (order.status as string) === 'processing' ? 'bg-pink-100 text-orange-800' :
                    order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status === 'delivered' ? t('profile.orders.status.delivered') :
                     order.status === 'shipped' ? t('profile.orders.status.shipped') :
                     (order.status as string) === 'packing' ? 'Preparando Pacote' :
                     (order.status as string) === 'processing' ? t('profile.orders.status.processing') :
                     order.status === 'confirmed' ? t('profile.orders.status.confirmed') :
                     order.status === 'cancelled' ? t('profile.orders.status.cancelled') : t('profile.orders.status.pending')}
                  </span>
                </div>
              </div>

              {/* Acompanhamento do pedido — sempre visível */}
              {(() => {
                const hasTracking = !!(order as any).trackingNumber;
                const st = order.status as string;
                const steps = ['Pagamento', 'Preparando', 'Enviado', 'Entregue'];
                // Estado de cada etapa: 'done' (✓) | 'active' (atual) | 'pending' (futura).
                // IMPORTANTE: 'Pagamento confirmado' NÃO significa 'Preparando'. No Personal
                // Shopper, o preparo só começa quando o admin clica 'Preparando' (pode levar
                // 2-3 dias após o pagamento). Por isso 'confirmed' deixa Preparando como pending.
                type StepState = 'done' | 'active' | 'pending';
                const stepStates: StepState[] =
                  st === 'delivered' ? ['done', 'done', 'done', 'done']
                  : st === 'shipped'  ? ['done', 'done', 'done', 'pending']
                  : (st === 'processing' || st === 'packing') ? ['done', 'active', 'pending', 'pending']
                  : st === 'confirmed' ? ['done', 'pending', 'pending', 'pending']  // pago, ainda não preparando
                  : ['active', 'pending', 'pending', 'pending'];  // pending — aguardando pagamento
                return (
                  <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border">
                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      Acompanhamento do Pedido
                    </p>
                    <div className="flex items-center gap-1 mb-2">
                      {steps.map((label, i) => {
                        const state = stepStates[i];
                        const highlighted = state === 'done' || state === 'active';
                        // Conector preenchido se a PRÓXIMA etapa já começou (done/active)
                        const nextStarted = i < steps.length - 1 && stepStates[i + 1] !== 'pending';
                        return (
                          <React.Fragment key={i}>
                            <div className={`flex flex-col items-center ${i === 0 ? 'flex-shrink-0' : 'flex-1'}`}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${highlighted ? 'bg-primary text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                                {state === 'done' ? '✓' : i + 1}
                              </div>
                              <span className={`text-[9px] mt-0.5 text-center leading-tight ${highlighted ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{label}</span>
                            </div>
                            {i < steps.length - 1 && (
                              <div className={`flex-1 h-0.5 mb-3.5 ${nextStarted ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {!hasTracking && (
                      <p className="text-[11px] text-muted-foreground">
                        {st === 'pending' ? 'Aguardando confirmação do pagamento.'
                          : st === 'confirmed' ? '✅ Pagamento confirmado! O preparo do seu pedido começa em até 2-3 dias úteis (serviço Personal Shopper).'
                          : 'Seu pedido está sendo preparado. O código de rastreio aparecerá aqui após o envio.'}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Confirmar recebimento — visível quando pedido está enviado */}
              {order.status === 'shipped' && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">📦 Produto chegou?</p>
                    <p className="text-xs text-green-700 dark:text-green-400">Confirme o recebimento para encerrar o pedido.</p>
                  </div>
                  <button
                    onClick={() => handleConfirmReceived(order.orderNumber)}
                    disabled={confirmingOrderId === order.orderNumber}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
                  >
                    {confirmingOrderId === order.orderNumber ? 'Confirmando…' : '✅ Confirmar Recebimento'}
                  </button>
                </div>
              )}

              {/* Tracking Info — shown whenever a tracking number exists */}
              {(order as any).trackingNumber && (() => {
                const trackingNumber = ((order as any).trackingNumber as string).trim();
                const savedUrl = (order as any).trackingUrl || '';
                let carrierRaw = (order as any).carrier || (order as any).shipping?.carrier || '';

                // Detect carrier from saved URL if not set
                if (!carrierRaw && savedUrl) {
                  if (savedUrl.includes('kuronekoyamato')) carrierRaw = 'Yamato';
                  else if (savedUrl.includes('sagawa')) carrierRaw = 'Sagawa';
                  else if (savedUrl.includes('japanpost')) carrierRaw = 'Japan Post';
                  else if (savedUrl.includes('fukutsu')) carrierRaw = 'Fukutsu';
                  else if (savedUrl.includes('correios')) carrierRaw = 'Correios';
                }

                // Auto-detect from tracking code pattern when carrier still unknown
                if (!carrierRaw) {
                  const tnUp = trackingNumber.toUpperCase();
                  if (/^[A-Z]{2}\d{9}BR$/.test(tnUp)) carrierRaw = 'Correios';
                  else if (/^[A-Z]{2}\d{9}JP$/.test(tnUp)) carrierRaw = 'Japan Post';
                }

                const getCarrierName = (c: string) => {
                  const lc = c.toLowerCase();
                  if (lc.includes('correios')) return 'Correios (Brasil)';
                  if (lc.includes('ems')) return 'EMS / Japan Post';
                  if (lc.includes('yamato') || lc.includes('クロネコ')) return 'Yamato Transport (クロネコヤマト)';
                  if (lc.includes('sagawa') || lc.includes('佐川')) return 'Sagawa Express (佐川急便)';
                  if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('kozutsumi') || lc.includes('post')) return 'Japan Post (日本郵便)';
                  if (lc.includes('fukutsu') || lc.includes('福通')) return 'Fukutsu Express (福山通運)';
                  return c;
                };

                const getTrackingUrl = (c: string, tn: string) => {
                  const lc = c.toLowerCase();
                  // Brazilian Correios — handles international EMS codes ending in BR too
                  if (lc.includes('correios') || tn.toUpperCase().endsWith('BR'))
                    return `https://www.linketrack.com/trace?code=${tn}`;
                  if (lc.includes('ems'))
                    return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=pt`;
                  if (lc.includes('yamato') || lc.includes('クロネコ'))
                    return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${tn}`;
                  if (lc.includes('sagawa') || lc.includes('佐川'))
                    return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tn}`;
                  if (lc.includes('japan post') || lc.includes('kozutsumi') || lc.includes('post') || tn.toUpperCase().endsWith('JP'))
                    return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=pt`;
                  if (lc.includes('fukutsu') || lc.includes('福通'))
                    return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${tn}`;
                  // Unknown carrier — fallback to Correios (most common for Brazil orders)
                  return `https://www.linketrack.com/trace?code=${tn}`;
                };

                const carrierName = getCarrierName(carrierRaw);
                const trackingUrl = getTrackingUrl(carrierRaw, trackingNumber) || savedUrl;
                        
                return (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">{t('profile.orders.tracking.title')}</span>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-mono">
                      {t('profile.orders.tracking.code')}{' '}
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="underline hover:text-blue-900 font-bold">
                        {trackingNumber}
                      </a>
                    </p>
                    {carrierName && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {t('profile.orders.tracking.carrier')} {carrierName}
                      </p>
                    )}
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {t('profile.orders.tracking.btn')}
                    </a>
                  </div>
                );
              })()}

              <div className="space-y-2">
                {order.items.map((item, idx) => {
                  const pid = findProductId(item);
                  return (
                    <div key={idx} className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-muted-foreground flex-1 min-w-0">
                        {item.productName} ({item.size}) × {item.quantity}
                      </span>
                      {pid && user && (
                        <OrderItemReviewAction
                          userId={user.id}
                          productId={pid}
                          reviewLabel={t('profile.orders.review')}
                          reviewedLabel={t('profile.orders.reviewed')}
                          refreshKey={reviewBump}
                          onReview={() => setReviewTarget({ id: pid, name: item.productName })}
                        />
                      )}
                      <span className="font-medium shrink-0">
                        {item.price != null
                          ? formatPrice(item.price * item.quantity, (order as any).currency || 'JPY')
                          : formatPrice(((item as any).unitYen || 0) * item.quantity, 'JPY')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Order breakdown: subtotal, coupon, shipping, total */}
              {(() => {
                // `priceBreakdown` (gravado pelo checkout real, api/_lib/commerce.js
                // `buildQuote`) já vem convertido para `order.currency` — fonte de
                // verdade. Pedidos legados (venda manual, sem priceBreakdown) caem no
                // cálculo antigo a partir de `item.price` (que ali já é local).
                const pb = (order as any).priceBreakdown as
                  | {
                      subtotal?: number; couponDiscount?: number; pointsDiscount?: number; psFee?: number;
                      shipping?: number; importDuty?: number; pixIof?: number; pixBankFee?: number;
                    }
                  | undefined;
                const itemsSubtotal = pb?.subtotal ?? order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
                const discount = pb
                  ? (pb.couponDiscount || 0)
                  : ((order as any).couponDiscount || (itemsSubtotal > order.totalAmount ? itemsSubtotal - order.totalAmount : 0));
                const psFee = pb?.psFee || 0;
                const shippingData = (order as any).shipping;
                // Pedido novo: frete já na moeda do pedido (`pb.shipping`). Legado: ¥.
                const shippingCost = pb?.shipping ?? shippingData?.cost ?? null;
                const carrierName = shippingData?.carrier || '';
                const couponCode = (order as any).couponCode || (order as any).appliedCoupon?.code || '';
                const oc = (order as any).currency || 'JPY';
                const shippingCurrency = pb?.shipping != null ? oc : 'JPY';
                const pointsDiscount = pb?.pointsDiscount || 0;
                const importDuty = pb?.importDuty || 0;
                const pixFees = (pb?.pixIof || 0) + (pb?.pixBankFee || 0);

                return (
                  <div className="mt-2 pt-2 border-t border-border space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('profile.orders.subtotal')}</span>
                      <span>{formatPrice(itemsSubtotal, oc)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {t('profile.orders.coupon')} {couponCode && <span className="font-mono text-xs">({couponCode})</span>}
                        </span>
                        <span>-{formatPrice(discount, oc)}</span>
                      </div>
                    )}
                    {shippingCost != null && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          {t('profile.orders.shipping')} {carrierName && <span className="text-xs">({carrierName})</span>}
                        </span>
                        <span>{shippingCost === 0 ? <span className="text-green-600">{t('profile.orders.free')}</span> : formatPrice(shippingCost, shippingCurrency)}</span>
                      </div>
                    )}
                    {pointsDiscount > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>Desconto em pontos</span>
                        <span>-{formatPrice(pointsDiscount, oc)}</span>
                      </div>
                    )}
                    {psFee > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Taxa Personal Shopper</span>
                        <span>{formatPrice(psFee, oc)}</span>
                      </div>
                    )}
                    {importDuty > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Imposto EUA (pré-pago, DDP)</span>
                        <span>{formatPrice(importDuty, oc)}</span>
                      </div>
                    )}
                    {pixFees > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>IOF + taxa bancária (PIX)</span>
                        <span>{formatPrice(pixFees, oc)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold pt-1 border-t border-border">
                      <span>{t('profile.orders.total')}</span>
                      <span className="text-primary">
                        {(order as any).grandTotalYen && oc !== 'JPY'
                          ? `${formatPrice(order.totalAmount, oc, true)} (¥ ${((order as any).grandTotalYen as number).toLocaleString()})`
                          : formatPrice(order.totalAmount, oc)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 pt-3 border-t border-border space-y-2">
                {/* Payment Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t('profile.orders.payment')}{' '}
                      {order.paymentMethod === 'pix' ? 'PIX'
                        : order.paymentMethod === 'wise' ? 'Wise'
                        : order.paymentMethod === 'paypay' ? 'PayPay'
                        : order.paymentMethod === 'yucho' ? 'Yucho'
                        : order.paymentMethod === 'card' ? 'Cartão de Crédito'
                        : order.paymentMethod === 'bank' ? t('profile.orders.payment.bank')
                        : order.paymentMethod || 'N/A'}
                    </span>
                    {isPaid ? (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                        ✅ Pago
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-pink-600 flex items-center gap-1">
                        ⏳ Pendente
                      </span>
                    )}
                  </div>
                </div>
                {!isPaid && order.paymentMethod === 'wise' && (
                  <ChangeToCard orderId={String(order.orderNumber)} onPaid={() => { void refreshOrders(); setTimeout(() => { void refreshOrders(); }, 5000); }} />
                )}
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      const printWindow = window.open('', '', 'width=800,height=600');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html><head><title>Comprovante ${order.orderNumber}</title></head><body>
                          <h1>Comprovante de Pedido</h1>
                          <p><strong>Número:</strong> ${order.orderNumber}</p>
                          <p><strong>Data:</strong> ${new Date(order.date).toLocaleDateString('pt-BR')}</p>
                          <p><strong>Total:</strong> ${formatPrice(order.totalAmount, (order as any).currency || 'JPY')}</p>
                          <p><strong>Status do Pagamento:</strong> ${isPaid ? '✅ Pago' : '⏳ Pendente'}</p>
                          <button onclick="window.print()">Imprimir</button>
                          </body></html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-primary hover:bg-primary/10"
                  >
                    <FileText className="w-3 h-3" />
                    Comprovante
                  </Button>
                  <Button
                    onClick={() => handleReorder(order)}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-primary hover:bg-primary/10"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t('profile.orders.reorder')}
                  </Button>
                </div>
              </div>
            </div>
            );
          })}
          {ordersHasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMoreOrders()}
                disabled={ordersLoadingMore}
              >
                {ordersLoadingMore ? '...' : t('profile.orders.loadMore')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-2">
            {t('profile.orders.none')}
          </p>
          <Button
            className="btn-primary mt-4"
            onClick={() => navigate('/produtos')}
          >
            {t('profile.orders.start')}
            <ShoppingBag className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
    </>
  );
};

export default ProfileOrderHistory;
