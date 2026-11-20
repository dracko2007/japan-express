import React from 'react';
import { Package, Calendar, FileText, Printer, User, Mail, Phone, MapPin, ShoppingBag, Tag, Truck, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { isLocalOrder, isMixedOrder, carrierText, localShippingText } from '@/components/admin/orderHelpers';
import { Button } from '@/components/ui/button';
import { printOrder, printShippingLabel } from '@/utils/adminOrderPrint';
import { OrderItem, Order } from '@/types';
import { itemPhoto, orderYenView, fmtOrderMoney, orderTotalYen, fmtPair } from '@/utils/adminOrderMoney';

interface AdminOrdersListProps {
  ordersLoading: boolean;
  allOrders: Order[];
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  setCn23Order: (value: React.SetStateAction<Order>) => void;
  handleConfirmPayment: (orderNumber: string) => Promise<void>;
  handleUpdateStatus: (orderNumber: string, newStatus: "pending" | "processing" | "packing" | "shipped" | "delivered" | "cancelled") => Promise<void>;
  setSelectedOrder: (value: React.SetStateAction<Order>) => void;
  setTrackingModalOpen: (value: React.SetStateAction<boolean>) => void;
  handleCancelOrder: (orderNumber: string) => Promise<void>;
  handleDeleteOrder: (orderNumber: string) => Promise<void>;
  ordersHasMore: boolean;
  loadOrders: (append?: boolean) => Promise<void>;
  ordersLoadingMore: boolean;
}

const AdminOrdersList: React.FC<AdminOrdersListProps> = ({
  ordersLoading,
  allOrders,
  getStatusColor,
  getStatusLabel,
  setCn23Order,
  handleConfirmPayment,
  handleUpdateStatus,
  setSelectedOrder,
  setTrackingModalOpen,
  handleCancelOrder,
  handleDeleteOrder,
  ordersHasMore,
  loadOrders,
  ordersLoadingMore,
}) => {
  return (
    <>
    {/* Orders List */}
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">
        Pedidos Recentes
      </h2>
              
      {ordersLoading ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      ) : allOrders.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum pedido encontrado</p>
        </div>
      ) : (
        allOrders.map((order, index) => (
          <div key={order.orderNumber || order.id} className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">
                    Pedido #{order.orderNumber || `ORD-${index + 1}`}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status || 'pending')}`}>
                    {getStatusLabel(order.status || 'pending')}
                  </span>
                  {isLocalOrder(order) && (
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-extrabold uppercase text-white">
                      📍 Enviar do {order.shipFrom}
                    </span>
                  )}
                  {isMixedOrder(order) && (
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-extrabold uppercase text-white">
                      📍 2 envios: {order.shipFrom} + Japão
                    </span>
                  )}
                </div>
                {isMixedOrder(order) && (
                  <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    Um pagamento, dois envios: os itens marcados com 📍 saem do estoque do {order.shipFrom} (frete nacional); os demais saem do Japão.
                  </p>
                )}
                {isLocalOrder(order) && (
                  <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    Este pedido NÃO sai do Japão: as unidades estão no estoque do {order.shipFrom} e seguem por frete nacional.
                  </p>
                )}
                <p className="text-sm text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {new Date(order.orderDate).toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground font-semibold">
                  💳 {order.paymentMethod === 'pix' ? 'PIX'
                    : order.paymentMethod === 'wise' ? 'Wise'
                    : order.paymentMethod === 'paypay' ? 'PayPay'
                    : order.paymentMethod === 'yucho' ? 'Yucho'
                    : order.paymentMethod === 'card' ? 'Cartão de Crédito'
                    : order.paymentMethod === 'boleto' ? 'Boleto Bancário'
                    : order.paymentMethod || 'N/A'}
                </p>
              </div>
                      
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  onClick={() => setCn23Order(order)}
                  variant="outline"
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <FileText className="w-4 h-4" />
                  CN22/CN23
                </Button>
                <Button
                  onClick={() => printOrder(order)}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Pedido
                </Button>
                <Button
                  onClick={() => printShippingLabel(order)}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Etiqueta
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border">
              {/* Customer Info */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </h4>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{order.shippingAddress?.name || order.customerName || 'N/A'}</p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {order.customerEmail || 'N/A'}
                  </p>
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.shippingAddress?.phone || order.customerName || 'N/A'}
                  </p>
                  <p className="text-muted-foreground flex items-start gap-2 mt-2">
                    <MapPin className="w-4 h-4 mt-0.5" />
                    <span>
                      〒{order.shippingAddress?.postalCode || 'N/A'}<br />
                      {order.shippingAddress?.prefecture} {order.shippingAddress?.city}<br />
                      {order.shippingAddress?.address}
                      {order.shippingAddress?.building && <><br />{order.shippingAddress.building}</>}
                    </span>
                  </p>
                </div>
              </div>

              {/* Products */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Produtos
                </h4>
                <div className="space-y-2">
                  {order.items.map((item: OrderItem, i: number) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                       {itemPhoto(item) ? (
                         <img src={itemPhoto(item) as string} alt={item.productName || item.name || 'Produto'} loading="lazy" className="h-12 w-12 shrink-0 rounded-md border border-border object-cover" />
                       ) : (
                         <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground"><ShoppingBag className="h-4 w-4" /></div>
                       )}
                       <span className="flex-1">{isMixedOrder(order) && item.local ? '📍 ' : ''}{item.productName || item.name} ({item.size}) x{item.quantity}</span>
                       <span className="font-semibold font-mono whitespace-nowrap">{orderYenView(order) ? orderYenView(order)!.itemValue(item) : fmtOrderMoney(item.price * item.quantity, order.currency)}</span>
                    </div>
                  ))}
                  {(() => {
                    const itemsSubtotal = order.items.reduce((sum: number, item: OrderItem) => sum + item.price * item.quantity, 0);
                    // Detect coupon discount: saved field OR inferred from items sum vs totalPrice
                    const discount = order.couponDiscount || (itemsSubtotal > order.totalPrice ? itemsSubtotal - order.totalPrice : 0);
                    const shippingCost = order.shipping?.cost ?? null;
                    // Igual ao site: valor na moeda do pedido e os ienes entre parênteses.
                    const yv = orderYenView(order);
                    return (
                      <div className="pt-2 border-t border-border space-y-1">
                        {/* Subtotal */}
                        <div className="flex justify-between text-sm">
                          <span>Subtotal</span>
                          <span className="font-mono">{yv ? yv.subtotal : fmtOrderMoney(itemsSubtotal, order.currency)}</span>
                        </div>
                                
                        {/* Coupon Discount */}
                        {(yv ? yv.discount !== null : discount > 0) && (
                          <div className="flex justify-between text-sm text-green-600 font-bold">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              Cupom {order.couponCode && <span className="font-mono bg-green-100 px-1 rounded text-xs">{order.couponCode}</span>}
                            </span>
                            <span className="font-mono">{yv && yv.discount ? yv.discount : `-${fmtOrderMoney(discount, order.currency)}`}</span>
                          </div>
                        )}
                                
                        {/* Shipping */}
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            Frete {order.shippingCarrier && <span className="text-muted-foreground text-xs">({carrierText(order)})</span>}
                          </span>
                          <span className="font-mono">{localShippingText(order) ?? (yv ? (yv.shipping === 'Grátis' ? <span className="text-green-600">Grátis</span> : yv.shipping) : shippingCost != null ? (shippingCost === 0 ? <span className="text-green-600">Grátis</span> : `¥ ${Math.round(shippingCost).toLocaleString('en-US')}`) : 'N/A')}</span>
                        </div>

                        {/* Taxa Personal Shopper (cobrada, ou isenta) */}
                        {yv && yv.psFee && (
                          <div className="flex justify-between text-sm">
                            <span>Taxa PS (Personal Shopper)</span>
                            <span className={`font-mono ${yv.psFeeNote === 'waived' ? 'text-green-600 font-semibold' : ''}`}>{yv.psFee}</span>
                          </div>
                        )}

                        {/* Impostos */}
                        {(order.federalTax > 0 || order.icmsTax > 0 || order.taxAmount > 0) && (
                          order.federalTax != null && order.icmsTax != null ? (
                            <>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>II Federal</span>
                                <span className="font-mono">R$ {Number(order.federalTax).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>ICMS (17%)</span>
                                <span className="font-mono">R$ {Number(order.icmsTax).toFixed(2)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Impostos Estimados (II + ICMS)</span>
                              <span className="font-mono">R$ {Number(order.taxAmount || 0).toFixed(2)}</span>
                            </div>
                          )
                        )}
                                
                        {/* Total */}
                        <div className="flex justify-between font-bold pt-1 border-t border-border text-base">
                          <span>Total Geral</span>
                          <span className="text-primary font-mono">
                            {yv
                              ? yv.total
                              : orderTotalYen(order) > 0 && order.currency !== 'JPY'
                                ? fmtPair(orderTotalYen(order), order.totalPrice ?? order.total ?? 0, order.currency)
                                : fmtOrderMoney(order.totalPrice ?? order.total ?? 0, order.currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
              {order.status === 'pending' && (
                <>
                  <Button
                    onClick={() => handleConfirmPayment(order.orderNumber)}
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    ✅ Confirmar Pagamento Recebido
                  </Button>
                  <Button
                    onClick={() => handleUpdateStatus(order.orderNumber, 'processing')}
                    size="sm"
                    variant="outline"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Já Processando
                  </Button>
                </>
              )}
              {(order.status === 'processing' || order.status === 'confirmed') && (
                <Button
                  onClick={() => handleUpdateStatus(order.orderNumber, 'packing')}
                  size="sm"
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Package className="w-4 h-4" />
                  Preparando Pacote
                </Button>
              )}
              {order.status === 'packing' && (
                <Button
                  onClick={() => {
                    setSelectedOrder(order);
                    setTrackingModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Truck className="w-4 h-4" />
                  Marcar como Enviado
                </Button>
              )}
              {order.status === 'shipped' && (
                <>
                  <Button
                    onClick={() => handleUpdateStatus(order.orderNumber, 'delivered')}
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4" />
                    ✅ Pacote Recebido pelo Admin
                  </Button>
                </>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <Button
                  onClick={() => handleCancelOrder(order.orderNumber)}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-orange-600 hover:text-orange-700"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </Button>
              )}
              <Button
                onClick={() => handleDeleteOrder(order.orderNumber)}
                variant="destructive"
                size="sm"
                className="gap-2 ml-auto"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            </div>
          </div>
        ))
      )}

      {allOrders.length > 0 && ordersHasMore && (
        <div className="flex justify-center pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadOrders(true)}
            disabled={ordersLoadingMore}
          >
            {ordersLoadingMore ? 'Carregando...' : 'Carregar mais pedidos'}
          </Button>
        </div>
      )}
    </div>
    </>
  );
};

export default AdminOrdersList;
