import type { Order, OrderItem } from '@/types';
import { orderTotalYen, orderYenView, itemPhoto, fmtOrderMoney, fmtPair } from '@/utils/adminOrderMoney';
import { COMPANY_PROFILE } from '@/config/companyProfile';
import { escapeHtml, isLocalOrder, isMixedOrder, carrierText, localShippingText } from '@/components/admin/orderHelpers';

export const printOrder = (order: Order): void => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;

  const statusLabel: Record<string, string> = {
    pending: '⏳ Pendente',
    processing: '✅ Pagamento Confirmado',
    packing: '📦 Preparando Pacote',
    shipped: '🚚 Enviado',
    delivered: '🎉 Entregue',
    cancelled: '❌ Cancelado',
  };

  const paymentLabel: Record<string, string> = {
    pix: '📱 PIX',
    card: '💳 Cartão de Crédito',
    boleto: '📄 Boleto Bancário',
    wise: '💸 Wise (Transferência)',
    paypal: '🅿️ PayPal',
    yucho: '🏦 Banco Yucho',
  };

  const itemsSubtotal = order.items.reduce((s: number, i: OrderItem) => s + i.price * i.quantity, 0);
  const discount = order.couponDiscount || (itemsSubtotal > order.totalPrice ? itemsSubtotal - order.totalPrice : 0);
  const shippingCost = order.shipping?.cost ?? null;
  const grandTotal = order.totalPrice ?? order.total ?? 0;
  const grandTotalYen = orderTotalYen(order);
  const yenView = orderYenView(order);

  const itemsHtml = order.items.map((item: OrderItem) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${itemPhoto(item) ? `<img src="${escapeHtml(itemPhoto(item) as string)}" width="40" height="40" alt="" style="vertical-align:middle;margin-right:8px;border-radius:6px;object-fit:cover;border:1px solid #eee">` : ''}${isMixedOrder(order) && item.local ? '📍 ' : ''}${escapeHtml(item.productName || item.name)}${item.size ? ` <span style="color:#888;font-size:12px;">(${escapeHtml(item.size)})</span>` : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${Number(item.quantity) || 0}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${yenView ? yenView.itemValue(item) : fmtOrderMoney(Number(item.price) * Number(item.quantity), order.currency)}</td>
    </tr>
  `).join('');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Pedido ${escapeHtml(order.orderNumber || 'N/A')}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; background: #fff; padding: 24px; }
  .no-print { margin-bottom: 16px; }
  @media print { .no-print { display: none; } body { padding: 0; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e4003a; padding-bottom: 14px; margin-bottom: 18px; }
  .logo { font-size: 22px; font-weight: 900; color: #e4003a; }
  .logo span { color: #111; }
  .order-id { font-size: 18px; font-weight: bold; }
  .order-date { font-size: 12px; color: #666; margin-top: 4px; }
  .status-badge { display: inline-block; background: #fef3c7; color: #92400e; font-weight: bold; font-size: 12px; padding: 3px 10px; border-radius: 20px; margin-top: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .section h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #555; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .section p { font-size: 13px; margin: 4px 0; line-height: 1.5; }
  .section p.label { color: #888; font-size: 11px; margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #f9fafb; text-align: left; padding: 6px 8px; font-size: 12px; color: #666; }
  th:last-child, td:last-child { text-align: right; }
  th:nth-child(2), td:nth-child(2) { text-align: center; }
  .totals { margin-top: 4px; }
  .totals tr td { padding: 4px 8px; font-size: 13px; }
  .totals tr.grand td { font-weight: bold; font-size: 15px; border-top: 2px solid #111; padding-top: 8px; }
  .totals tr.discount td { color: #16a34a; }
  .footer { margin-top: 24px; border-top: 1px dashed #ccc; padding-top: 14px; text-align: center; font-size: 11px; color: #aaa; }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:8px 20px;font-size:14px;cursor:pointer;background:#e4003a;color:#fff;border:none;border-radius:6px;margin-right:8px;">🖨️ Imprimir</button>
  <button onclick="window.close()" style="padding:8px 16px;font-size:14px;cursor:pointer;border:1px solid #ccc;border-radius:6px;">✕ Fechar</button>
</div>

<div class="header">
  <div>
    <div class="logo">🌸 Japan <span>Express</span></div>
    <div style="font-size:11px;color:#888;margin-top:2px;">Importação Direta Japão-Brasil</div>
  </div>
  <div style="text-align:right;">
    <div class="order-id">Pedido: ${escapeHtml(order.orderNumber || 'N/A')}</div>
    <div class="order-date">${escapeHtml(new Date(order.orderDate || order.date || Date.now()).toLocaleString('pt-BR'))}</div>
    <div class="status-badge">${escapeHtml(statusLabel[order.status] || order.status || 'N/A')}</div>
  </div>
</div>
${isMixedOrder(order) ? `<div style="margin:0 0 14px;padding:10px 14px;border:2px solid #059669;background:#ecfdf5;color:#065f46;font-weight:800;border-radius:8px;">📍 DOIS ENVIOS — itens marcados com 📍 saem do estoque do ${escapeHtml(String(order.shipFrom))} (frete nacional); os demais saem do Japão.</div>` : ''}
${isLocalOrder(order) ? `<div style="margin:0 0 14px;padding:10px 14px;border:2px solid #059669;background:#ecfdf5;color:#065f46;font-weight:800;border-radius:8px;">📍 ENVIAR DO ${escapeHtml(String(order.shipFrom).toUpperCase())} — estoque local, frete nacional. Não sai do Japão.</div>` : ''}
<div class="grid">
  <div class="section">
    <h3>👤 Cliente</h3>
    <p><strong>${escapeHtml(order.shippingAddress?.name || order.customerName || 'N/A')}</strong></p>
    <p class="label">E-mail</p>
    <p>${escapeHtml(order.customerEmail || 'N/A')}</p>
    <p class="label">Telefone</p>
    <p>${escapeHtml(order.shippingAddress?.phone || order.phone || 'N/A')}</p>
    ${order.cpf ? `<p class="label">CPF</p><p>${escapeHtml(order.cpf)}</p>` : ''}
  </div>
  <div class="section">
    <h3>📍 Endereço de Entrega</h3>
    <p>〒 ${escapeHtml(order.shippingAddress?.postalCode || 'N/A')}</p>
    <p>${escapeHtml(`${order.shippingAddress?.prefecture || ''} ${order.shippingAddress?.city || ''}`)}</p>
    <p>${escapeHtml(order.shippingAddress?.address || '')}</p>
    ${order.shippingAddress?.building ? `<p>${escapeHtml(order.shippingAddress.building)}</p>` : ''}
  </div>
</div>

<div class="section" style="margin-bottom:20px;">
  <h3>📦 Itens do Pedido</h3>
  <table>
    <thead>
      <tr>
        <th>Produto</th>
        <th>Qtd</th>
        <th>Valor</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <table class="totals">
    <tr>
      <td>Subtotal</td>
      <td></td>
      <td>${yenView ? yenView.subtotal : fmtOrderMoney(itemsSubtotal, order.currency)}</td>
    </tr>
    ${(yenView ? yenView.discount !== null : discount > 0) ? `<tr class="discount"><td>Cupom ${order.couponCode ? `(${escapeHtml(order.couponCode)})` : ''}</td><td></td><td>${yenView && yenView.discount ? yenView.discount : `-${fmtOrderMoney(discount, order.currency)}`}</td></tr>` : ''}
    <tr>
      <td>Frete ${order.shippingCarrier ? `(${escapeHtml(carrierText(order))})` : ''}</td>
      <td></td>
      <td>${localShippingText(order) ? escapeHtml(localShippingText(order) as string) : yenView ? yenView.shipping : shippingCost != null ? (shippingCost === 0 ? 'Grátis' : `¥ ${Math.round(shippingCost).toLocaleString('en-US')}`) : 'N/A'}</td>
    </tr>
    ${yenView && yenView.psFee ? `<tr><td>Taxa PS (Personal Shopper)</td><td></td><td>${yenView.psFee}</td></tr>` : ''}
    ${(order.federalTax > 0 || order.icmsTax > 0 || order.taxAmount > 0) ? `<tr><td style="color:#888;font-size:12px;">Impostos (II + ICMS)</td><td></td><td style="color:#888;font-size:12px;">R$ ${Number(order.federalTax && order.icmsTax ? (order.federalTax + order.icmsTax) : order.taxAmount || 0).toFixed(2)}</td></tr>` : ''}
    <tr class="grand">
      <td>Total Geral</td>
      <td></td>
      <td style="color:#e4003a;">${yenView ? yenView.total : grandTotalYen && order.currency !== 'JPY' ? fmtPair(grandTotalYen, grandTotal, order.currency) : fmtOrderMoney(grandTotal, order.currency)}</td>
    </tr>
  </table>
</div>

<div class="section">
  <h3>💳 Pagamento</h3>
  <p>${escapeHtml(paymentLabel[order.paymentMethod] || order.paymentMethod || 'N/A')}</p>
  <p style="margin-top:6px;">Status: <strong>${escapeHtml(statusLabel[order.status] || order.status || 'N/A')}</strong></p>
</div>

<div class="footer">
  Japan Express · www.japanexpress-store.com · Impresso em ${new Date().toLocaleString('pt-BR')}
</div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
};

export const printShippingLabel = (order: Order): void => {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Etiqueta de Envio - ${escapeHtml(order.orderNumber || 'N/A')}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .label { border: 3px solid #000; padding: 20px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
        .section { margin-bottom: 20px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .box { border: 2px dashed #666; padding: 15px; }
        h1 { margin: 0 0 5px 0; font-size: 28px; }
        h2 { margin: 0; font-size: 14px; color: #666; }
        h3 { margin: 0 0 10px 0; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        p { margin: 5px 0; font-size: 14px; }
        .strong { font-weight: bold; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; font-size: 16px; cursor: pointer;">
        🖨️ Imprimir Etiqueta
      </button>
      
      <div class="label">
        <div class="header">
          <h1>🌸 JAPAN EXPRESS</h1>
          <h2>Importação Direta Japão-Brasil</h2>
          <p class="strong">Pedido: ${escapeHtml(order.orderNumber || 'N/A')}</p>
          <p>Data: ${escapeHtml(new Date(order.orderDate || order.date || Date.now()).toLocaleDateString('pt-BR'))}</p>
        </div>

        <div class="section">
          <h3>📦 PRODUTOS</h3>
          ${order.items.map((item: OrderItem) => `
            <p>• ${escapeHtml(item.productName || item.name)} (${escapeHtml(item.size || '')}) x${Number(item.quantity) || 0} - R$${(Number(item.price) * Number(item.quantity)).toLocaleString()}</p>
          `).join('')}
          <p class="strong" style="margin-top: 10px;">Total: R$${Number(order.totalPrice ?? order.totalAmount ?? 0).toLocaleString()}</p>
        </div>

        <div class="row">
          <div class="box">
            <h3>📤 REMETENTE (ご依頼主)</h3>
            <p class="strong">${escapeHtml(COMPANY_PROFILE.contactName)}</p>
            <p>〒${escapeHtml(COMPANY_PROFILE.fulfillmentOrigin.postalCode)}</p>
            <p>${escapeHtml(COMPANY_PROFILE.fulfillmentOrigin.formattedJa.replace(`〒${COMPANY_PROFILE.fulfillmentOrigin.postalCode} `, ''))}</p>
            <p>📞 ${escapeHtml(COMPANY_PROFILE.whatsapp.domestic)}</p>
          </div>
          
          <div class="box">
            <h3>📥 DESTINATÁRIO (Aduana Brasil)</h3>
            <p class="strong">${escapeHtml(order.shippingAddress?.name || order.name || order.customerName || 'N/A')}</p>
            <p>CPF: ${escapeHtml(order.cpf || 'N/A')}</p>
            <p>CEP: ${escapeHtml(order.shippingAddress?.postalCode || order.postalCode || 'N/A')}</p>
            <p>${escapeHtml(`${order.shippingAddress?.prefecture || order.prefecture || ''} - ${order.shippingAddress?.city || order.city || ''}`)}</p>
            <p>${escapeHtml(order.shippingAddress?.address || order.address || '')}</p>
            ${(order.shippingAddress?.building || order.building) ? `<p>Complemento: ${escapeHtml(order.shippingAddress?.building || order.building)}</p>` : ''}
            <p>📞 ${escapeHtml(order.shippingAddress?.phone || order.phone || 'N/A')}</p>
          </div>
        </div>

        <div class="section" style="margin-top: 20px;">
          <h3>💳 PAGAMENTO</h3>
          <p>${order.paymentMethod === 'pix' ? '📱 PIX' : order.paymentMethod === 'card' ? '💳 Cartão de Crédito' : '📄 Boleto Bancário'}</p>
          <p class="strong">Status: ${order.status === 'pending' || order.status === 'Pendente' ? '⏳ Pendente' : '✅ Confirmado / Pago'}</p>
        </div>
      </div>

      <div class="no-print" style="text-align: center; margin-top: 20px;">
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
          ❌ Fechar
        </button>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
