import { safeStorage } from '@/utils/storage';
import { recoveryCouponState } from '@/utils/recoveryCouponState';
import React, { useState, useEffect, useMemo } from 'react';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { useNavigate, useLocation } from 'react-router-dom';
import { Printer, CreditCard, Landmark, Smartphone, CheckCircle, Copy, AlertCircle, ExternalLink, Wallet as WalletIcon, X } from 'lucide-react';
import { couponService as globalCouponService } from '@/services/couponService';
import { QRCodeSVG } from 'qrcode.react';
import { buildPixPayload } from '@/utils/pixPayload';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useProducts } from '@/context/ProductsContext';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen } from '@/utils/pricing';
import { convertYen as fxConvert, getRatesId } from '@/services/fxService';
import { cartBenefits, computeCheckoutTotals } from '@/utils/checkoutTotals';
import { localOffer, setShipAllFromJapan, splitCart } from '@/utils/localStock';
import { psFeeWaiver } from '@/utils/psFeeWaiver';
import { earnedPointsForOrder, POINTS, pointsMultiplierForSpend } from '@/services/pointsService';
import { recentProductSpendYen } from '@/utils/loyaltySpend';
import { paymentSettingsService } from '@/services/paymentSettingsService';
import { calcImportTax } from '@/utils/taxRules';
import { thermalPrintService } from '@/services/thermalPrintService';
import StripeCardForm from '@/components/checkout/StripeCardForm';
import {
  CheckoutError,
  checkoutErrorMessage,
  prepareCheckout,
  quoteCheckout,
  type AuthoritativeCheckoutOrder,
  type CheckoutPaymentMethod,
  type CheckoutQuote,
} from '@/services/checkoutService';
import { getCountryConfig } from '@/data/worldCountries';
import OrderReviewPaymentSummary from '@/components/checkout/OrderReviewPaymentSummary';
import OrderReviewPaymentMethod from '@/components/checkout/OrderReviewPaymentMethod';
import OrderReviewShippingAddress from '@/components/checkout/OrderReviewShippingAddress';
import OrderReviewCustomerInfo from '@/components/checkout/OrderReviewCustomerInfo';
import OrderReviewItemsSummary from '@/components/checkout/OrderReviewItemsSummary';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const OrderReview: React.FC = () => {
  const { selectedItems: items, removePurchasedItems } = useCart();
  const { refresh: refreshProducts } = useProducts();
  const { consumeCouponByCode, user, addPoints, addOrder, addCoupon, orders } = useUser();
  const [pointsToUse, setPointsToUse] = useState<number>(() => {
    const v = Number(safeStorage.getItem('redeem_points'));
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const formData = location.state?.formData;
  const shipping = location.state?.shipping;
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    freeShipping?: boolean;
    discount?: number;
    discountType?: string;
    affiliateCode?: string;
    minOrderValue?: number;
  } | null>(
    (location.state?.coupon as { code: string; freeShipping?: boolean } | null | undefined) ?? null,
  );
  const psFeeYen: number = location.state?.psFeeYen || 0;
  const psFeeDiscountYen: number = location.state?.psFeeDiscountYen || 0;
  const shippingDiscountYen: number = location.state?.shippingDiscountYen || 0;
  const negotiationId: string | null = location.state?.negotiationId || null;
  const isGuest: boolean = !!location.state?.isGuest;
  // Pedido de estoque local: preço fixo na moeda do cliente + frete nacional (vem do checkout).
  const localOrder: boolean = location.state?.fulfillment === 'local';
  // 'local' = tudo sai do país do cliente; 'mixed' = parte de lá e parte do Japão (um pedido, dois envios).
  const mixedOrder: boolean = localOrder && location.state?.localKind === 'mixed';
  const pureLocalOrder: boolean = localOrder && !mixedOrder;
  const localShippingDisplay: number = Number(location.state?.localShippingDisplay) || 0;
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState(() => {
    return formData?.country === 'Japão' ? 'paypay' : 'wise';
  });
  const WISE_INVITE_LINK = 'https://wise.com/invite/ahpc/juniorcelsotadaos';
  const [paySettings, setPaySettings] = useState<import('@/services/paymentSettingsService').PaymentSettings>({
    wiseLink: '', wiseEnabled: false,
    pixKey: '', pixReceiverName: 'Japan Express', pixCity: 'Sao Paulo',
    pixEnabled: false, cardEnabled: true,
    yuchoKigo: '', yuchoNumber: '', yuchoName: '', contactPhone: '',
  });

  // O pedido é criado no servidor antes de abrir o modal. Nenhuma mutação
  // financeira depende do navegador.
  const [paymentModal, setPaymentModal] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<AuthoritativeCheckoutOrder | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [orderCreating, setOrderCreating] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  // A cotação espera as formas de pagamento ativas: senão a primeira pergunta
  // ia com a Wise pré-selecionada e voltava "em manutenção" por um instante.
  const [paySettingsLoaded, setPaySettingsLoaded] = useState(false);
  useEffect(() => {
    paymentSettingsService.get().then((s) => {
      setPaySettings(s);
      // Se o método pré-selecionado (Wise, por padrão) estiver desativado,
      // troca automaticamente para o primeiro disponível.
      setPaymentMethod((current) => {
        if (formData?.country === 'Japão') return current;
        const enabledByMethod: Record<string, boolean> = { wise: s.wiseEnabled, pix: s.pixEnabled, card: s.cardEnabled };
        if (enabledByMethod[current]) return current;
        return (['wise', 'pix', 'card'] as const).find((m) => enabledByMethod[m]) || current;
      });
    }).catch(() => { /* segue com o padrão; o servidor recusa método desligado */ })
      .finally(() => setPaySettingsLoaded(true));
  }, [formData?.country]);

  // Redirect if no form data or shipping
  useEffect(() => {
    if (!formData || !shipping) {
      navigate('/checkout');
    }
  }, [formData, shipping, navigate]);

  // Hook precisa executar mesmo durante o redirecionamento sem estado.
  const recentSpendYen = useMemo(() => recentProductSpendYen(orders), [orders]);

  const country: string = formData?.country || '';
  const isJapan = country === 'Japão';
  const currency = getCurrencyByCountry(country);
  const isPix = paymentMethod === 'pix';

  // Pontos pagam só a mercadoria que sobra depois do cupom — o servidor
  // limita igual (`shared/money.js`).
  const availablePoints = user?.points || 0;
  const couponOnly = cartBenefits(items, appliedCoupon, 0, localOrder ? { country, currency, shippingDisplay: 0 } : null);
  const maxRedeemable = Math.min(
    availablePoints,
    Math.max(0, Math.floor((couponOnly.productSubtotalYen - couponOnly.couponDiscountYen) / POINTS.yenPerPoint)),
  );
  const redeemPoints = Math.max(0, Math.min(pointsToUse, maxRedeemable));

  // Prévia local com a MESMA função do servidor. Vale até a cotação do
  // servidor chegar (alguns décimos de segundo); com a mesma cotação de
  // câmbio, os números são idênticos.
  const shippingYenBase = shipping
    ? (currency === 'JPY' ? Number(shipping.cost) || 0 : Number(shipping.costYen) || 0)
    : 0;
  const local = computeCheckoutTotals({
    items,
    currency,
    country,
    paymentMethod,
    coupon: appliedCoupon,
    redeemPoints,
    shippingYen: shippingYenBase,
    shippingDiscountYen,
    // O checkout já mandou o desconto efetivo (isenção ou negociação, com o teto).
    negotiatedPsFee: psFeeDiscountYen > 0 ? { status: 'approved', approvedDiscountYen: psFeeDiscountYen } : null,
    local: localOrder ? { country, currency, shippingDisplay: localShippingDisplay } : null,
  });

  // Cotação do servidor: a conta que vale para a cobrança. Refeita a cada
  // troca de forma de pagamento, cupom ou pontos.
  const quoteInput = formData && shipping && paySettingsLoaded ? {
    paymentMethod: paymentMethod as CheckoutPaymentMethod,
    items: items
      .filter((item) => !item.freeGift)
      .map((item) => ({ productId: item.product.id, variantId: item.size, quantity: item.quantity })),
    customer: {
      name: formData.name,
      email: String(formData.email || user?.email || '').trim().toLowerCase(),
      phone: formData.phone || '',
      cpf: formData.cpf || '',
    },
    shippingAddress: {
      postalCode: formData.postalCode || '',
      prefecture: formData.prefecture || '',
      state: formData.state || '',
      city: formData.city || '',
      address: formData.address || '',
      building: formData.building || '',
      country: formData.country,
    },
    shippingCarrier: shipping.carrier,
    couponCode: appliedCoupon?.code || '',
    // Campanha, negociação e isenção da taxa PS são do envio do Japão.
    promoCode: pureLocalOrder ? '' : safeStorage.getItem('promo_applied') || '',
    pointsToRedeem: redeemPoints,
    negotiationId: pureLocalOrder ? '' : negotiationId || '',
    psFeeWaiverToken: pureLocalOrder ? '' : psFeeWaiver.token(),
    ...(localOrder ? { fulfillment: 'local' as const, localShippingChoice: String(location.state?.localShippingChoice || '') } : {}),
    ratesId: getRatesId(),
  } : null;
  const quoteInputKey = quoteInput ? JSON.stringify(quoteInput) : '';
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteKey, setQuoteKey] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  useEffect(() => {
    if (!quoteInputKey) return undefined;
    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError('');
    // Espera o cliente parar de digitar (campo de pontos) antes de perguntar.
    const timer = window.setTimeout(() => {
      quoteCheckout(JSON.parse(quoteInputKey))
        .then((next) => {
          if (cancelled) return;
          setQuote(next);
          setQuoteKey(quoteInputKey);
        })
        .catch((error) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteKey('');
          setQuoteError(error instanceof CheckoutError ? error.code : 'checkout_failed');
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quoteInputKey]);

  if (!formData || !shipping) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  // A cotação só vale para os dados com que foi pedida.
  const serverQuote = quote && quoteKey === quoteInputKey ? quote : null;
  const view = serverQuote ? serverQuote.display : { ...local.shown, tax: 0 };
  // O que será cobrado: a soma exata das linhas abaixo.
  const finalGrandTotal = serverQuote ? serverQuote.total : local.shown.total;
  const pixIofFee = view.pixIof;
  const pixBankFee = view.pixBankFee;
  // Total sem as taxas do PIX (é o total da Wise e do cartão).
  const grandTotal = finalGrandTotal - view.paymentFee;
  const grandTotalYen = (serverQuote ? serverQuote.display.wiseYen : undefined) ?? local.shown.wiseYen;
  const couponDiscount = view.couponDiscount;
  const pointsDiscount = view.pointsDiscount;
  const finalShippingCost = view.shipping;
  // Pedido misto: parte do frete é nacional (itens do país do cliente), o resto é do Japão.
  const nationalShipping = mixedOrder ? Number(serverQuote ? serverQuote.display.localShipping : local.shown.nationalShipping) || 0 : 0;
  const japanShippingCost = finalShippingCost - nationalShipping;
  const psFeeDisplay = view.psFee;
  const psFeeFinalYen = serverQuote ? serverQuote.psFeeYen : local.psFeeFinalYen;
  const psFeeGrossYen = serverQuote ? serverQuote.psFeeYen + serverQuote.psFeeDiscountYen : local.psFeeYen;
  const effectivePsFeeDiscountYen = serverQuote ? serverQuote.psFeeDiscountYen : local.psFeeDiscountYen;
  const pointsCoverAllProducts = local.benefits.pointsCoverAllProducts;
  const pointsMultiplier = serverQuote ? serverQuote.pointsMultiplier : pointsMultiplierForSpend(recentSpendYen);
  // Mesma função que `api/_lib/commerce.js` usa para creditar.
  const earnedPoints = serverQuote
    ? serverQuote.earnedPoints
    : earnedPointsForOrder(local.benefits.productSubtotalYen, local.benefits.pointsDiscountYen, pointsMultiplier);
  const serverUnitPrice = new Map(
    (serverQuote?.items || []).filter((item) => !item.freeGift)
      .map((item) => [`${item.requestedId || item.productId}:${item.variantId}`, item.price]),
  );
  // Itens que saem do país do cliente (preço fixo na moeda dele), antes e depois da cotação do servidor.
  const localItemSet = new Set(localOrder ? splitCart(items, country).localItems : []);
  const unitPriceFor = (item: (typeof items)[number]) => {
    if (item.freeGift) return 0;
    return serverUnitPrice.get(`${item.product.id}:${item.size}`)
      ?? (localItemSet.has(item) ? localOffer(item.product, country)?.price : undefined)
      ?? fxConvert(effectiveYen(item.product, item.size), currency);
  };

  // Imposto do destino só informativo (não entra no total). EUA: pré-pago e
  // somado como linha própria (`view.importDuty`).
  const { tax: estimatedTax, label: taxLabel } = calcImportTax(view.products, country, formData.prefecture);
  const quoteErrorMessage = quoteError ? checkoutErrorMessage(quoteError) : '';

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      // O desconto sai da conta única (prévia e cotação do servidor) a partir
      // do próprio cupom. Cupom fixo é em ienes: antes ele era descontado
      // como se fosse R$/€/$.
      // 1. Profile coupon
      if (user?.coupons) {
        const found = user.coupons.find((coupon) => coupon.code?.toUpperCase() === code && !coupon.isUsed);
        if (found) {
          setAppliedCoupon(found);
          setCouponInput('');
          toast({ title: `Cupom ${code} aplicado!`, description: 'O desconto já aparece no resumo.' });
          return;
        }
      }
      // 2. Global Firestore coupon
      const isPromoItem = (item: (typeof items)[number]) => item.product.id.endsWith('_promo');
      const regularSubtotalYen = items.filter(i => !i.freeGift && !isPromoItem(i))
        .reduce((s, i) => s + effectiveYen(i.product, i.size) * i.quantity, 0);
      const globalResult = await globalCouponService.validateCouponAsync(code, user?.email || undefined, regularSubtotalYen);
      if (globalResult.valid && globalResult.coupon) {
        const gc = globalResult.coupon;
        const couponObj = {
          id: `global-${gc.code}-${Date.now()}`,
          code: gc.code,
          description: gc.description || `Cupom ${gc.code}`,
          discount: gc.type === 'percent' ? (gc.discountPercent || gc.discount || 0) : (gc.discount || 0),
          discountType: gc.type === 'fixed' ? 'fixed' : 'percentage',
          expiresAt: gc.expiryDate,
          isUsed: false,
          freeShipping: gc.freeShipping,
        };
        setAppliedCoupon(couponObj);
        setCouponInput('');
        toast({ title: `Cupom ${code} aplicado!`, description: 'O desconto já aparece no resumo.' });
        return;
      }
      setCouponError('Cupom inválido ou expirado.');
    } catch {
      setCouponError('Erro ao validar cupom. Tente novamente.');
    } finally {
      setCouponLoading(false);
    }
  };

  // Passo 1: cria o pedido no servidor com o total que está na tela e abre o
  // modal de pagamento.
  const handleProceedToPayment = async () => {
    if (!quoteInput) return;
    const iso = getCountryConfig(formData.country)?.iso.toUpperCase() || 'XX';
    const orderId = formData.country === 'Japão'
      ? `SC-JP-${Math.floor(100000 + Math.random() * 900000)}`
      : `SE-${iso}-${Math.floor(100000 + Math.random() * 900000)}`;

    setOrderCreating(true);
    try {
      const result = await prepareCheckout({
        ...quoteInput,
        orderId,
        // O servidor recusa (sem cobrar nada) se a conta dele der outro número.
        expectedTotal: finalGrandTotal,
        ratesId: serverQuote?.ratesId || quoteInput.ratesId,
      });
      if (result.order.psFeeWaiverApplied === true) psFeeWaiver.clear();
      setPendingOrder(result.order);
      setStripeClientSecret(result.clientSecret || '');
      setPaymentModal(true);
    } catch (error) {
      const codigo = error instanceof CheckoutError ? error.code : '';
      if (codigo === 'price_changed' && error instanceof CheckoutError && error.quote) {
        // Nada foi criado nem cobrado. A tela passa a mostrar a conta nova e
        // o cliente confirma de novo, vendo o valor que vai pagar.
        setQuote(error.quote);
        setQuoteKey(quoteInputKey);
        toast({
          title: 'O valor foi atualizado',
          description: `${checkoutErrorMessage(codigo)} Novo total: ${formatPrice(error.quote.total, error.quote.currency, true)}.`,
          variant: 'destructive',
        });
        return;
      }
      const waiverInvalid = codigo === 'invalid_ps_fee_waiver' || codigo === 'ps_fee_waiver_already_used';
      if (waiverInvalid) psFeeWaiver.clear();
      toast({
        title: 'Não foi possível criar o pedido',
        description: checkoutErrorMessage(codigo),
        variant: 'destructive',
      });
    } finally {
      setOrderCreating(false);
    }
  };

  // Passo 2: usuário confirmou o pagamento — agora salva tudo e navega
  // O servidor já persistiu o pedido. Este passo apenas encerra a experiência
  // local; estoque, cupons, pontos e promoções aguardam pagamento confirmado.
  const handleFinalizeOrder = () => {
    if (!pendingOrder) return;

    if (!isGuest) {
      const existingOrders = JSON.parse(safeStorage.getItem('sakura_orders') || '[]') as AuthoritativeCheckoutOrder[];
      const deduped = existingOrders.filter((order) => order.orderNumber !== pendingOrder.orderNumber);
      safeStorage.setItem('sakura_orders', JSON.stringify([pendingOrder, ...deduped]));
    }
    if (pendingOrder.paymentMethod !== 'card') {
      void emailServiceSimple.sendOrderConfirmation({ orderNumber: pendingOrder.orderNumber });
    }
    void thermalPrintService.printOrder(pendingOrder);

    removePurchasedItems(); // só o que foi comprado: o que ficou desmarcado continua no carrinho
    recoveryCouponState.clear(); // cupom de recuperação é de um pedido só: já foi usado
    setShipAllFromJapan(false); // a escolha "tudo do Japão" vale só para o pedido que acabou de ser feito
    safeStorage.removeItem('redeem_points');
    safeStorage.removeItem('promo_applied');
    safeStorage.removeItem('pending_promo');
    safeStorage.removeItem('pending_promo_gift');
    safeStorage.removeItem('pending_promo_points');
    safeStorage.removeItem('promo_full_price');
    localStorage.removeItem('activeNegId');
    psFeeWaiver.clear();

    navigate('/order-confirmation', {
      state: {
        order: pendingOrder,
        isGuest,
      },
    });
  };

  return (
    <Layout>
      <div className="gradient-hero py-16 print:hidden">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Revisar Pedido
            </h1>
            <p className="text-muted-foreground text-lg">
              {isJapan 
                ? 'Verifique os dados de entrega doméstica antes de confirmar'
                : 'Verifique todos os dados da importação aérea antes de finalizar'
              }
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">

            {/* Print Button */}
            <div className="flex justify-end mb-6 print:hidden">
              <Button onClick={handlePrint} variant="outline" className="gap-2 font-semibold">
                <Printer className="w-4 h-4" />
                Imprimir Recibo
              </Button>
            </div>

            <div className="lg:grid lg:grid-cols-3 lg:gap-8 min-w-0">

              {/* ── COLUNA ESQUERDA ── */}
              <div className="lg:col-span-2 space-y-6 min-w-0">

            <OrderReviewItemsSummary
              isJapan={isJapan}
              items={items}
              unitPriceFor={unitPriceFor}
              mixedOrder={mixedOrder}
              localItemSet={localItemSet}
              country={country}
              currency={currency}
              localOrder={localOrder}
              view={view}
              appliedCoupon={appliedCoupon}
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              setCouponError={setCouponError}
              handleApplyCoupon={handleApplyCoupon}
              couponLoading={couponLoading}
              couponError={couponError}
              couponDiscount={couponDiscount}
              setAppliedCoupon={setAppliedCoupon}
              user={user}
              availablePoints={availablePoints}
              pointsCoverAllProducts={pointsCoverAllProducts}
              psFeeDiscountYen={psFeeDiscountYen}
              maxRedeemable={maxRedeemable}
              pointsToUse={pointsToUse}
              setPointsToUse={setPointsToUse}
              redeemPoints={redeemPoints}
              pointsDiscount={pointsDiscount}
              earnedPoints={earnedPoints}
              pointsMultiplier={pointsMultiplier}
              formData={formData}
              estimatedTax={estimatedTax}
              taxLabel={taxLabel}
              nationalShipping={nationalShipping}
              pureLocalOrder={pureLocalOrder}
              shipping={shipping}
              japanShippingCost={japanShippingCost}
              psFeeGrossYen={psFeeGrossYen}
              effectivePsFeeDiscountYen={effectivePsFeeDiscountYen}
              psFeeFinalYen={psFeeFinalYen}
              psFeeDisplay={psFeeDisplay}
              isPix={isPix}
              grandTotal={grandTotal}
              pixIofFee={pixIofFee}
              pixBankFee={pixBankFee}
              finalGrandTotal={finalGrandTotal}
              quoteErrorMessage={quoteErrorMessage}
            />
            <OrderReviewCustomerInfo
              isJapan={isJapan}
              formData={formData}
            />
            <OrderReviewShippingAddress
              formData={formData}
              isJapan={isJapan}
            />
            <OrderReviewPaymentMethod
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              isJapan={isJapan}
              paySettings={paySettings}
              grandTotalYen={grandTotalYen}
              WISE_INVITE_LINK={WISE_INVITE_LINK}
            />
            {/* Back Button */}
            <div className="print:hidden">
              <Button
                variant="outline"
                onClick={() => navigate('/checkout', { state: { formData, activeNegId: negotiationId } })}
                className="w-full rounded-xl py-5 text-base border-2"
              >
                ← Voltar e Editar Dados
              </Button>
            </div>

              </div>{/* end COLUNA ESQUERDA */}

              {/* ── COLUNA DIREITA STICKY ── */}
              <div className="lg:col-span-1 mt-6 lg:mt-0 min-w-0">
                <div className="sticky top-20 space-y-4 self-start min-w-0">

                  <OrderReviewPaymentSummary
                    items={items}
                    view={view}
                    currency={currency}
                    localOrder={localOrder}
                    couponDiscount={couponDiscount}
                    appliedCoupon={appliedCoupon}
                    pointsDiscount={pointsDiscount}
                    redeemPoints={redeemPoints}
                    finalShippingCost={finalShippingCost}
                    psFeeGrossYen={psFeeGrossYen}
                    effectivePsFeeDiscountYen={effectivePsFeeDiscountYen}
                    psFeeFinalYen={psFeeFinalYen}
                    psFeeDisplay={psFeeDisplay}
                    estimatedTax={estimatedTax}
                    taxLabel={taxLabel}
                    isPix={isPix}
                    grandTotal={grandTotal}
                    pixIofFee={pixIofFee}
                    pixBankFee={pixBankFee}
                    finalGrandTotal={finalGrandTotal}
                    paymentMethod={paymentMethod}
                    grandTotalYen={grandTotalYen}
                    quoteErrorMessage={quoteErrorMessage}
                    handleProceedToPayment={handleProceedToPayment}
                    orderCreating={orderCreating}
                    quoteLoading={quoteLoading}
                    user={user}
                    earnedPoints={earnedPoints}
                    pointsMultiplier={pointsMultiplier}
                  />
                  {/* Selos de segurança compactos */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-green-700 print:hidden">
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span>🔒</span><span className="font-semibold">HTTPS Seguro</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span>✅</span><span className="font-semibold">100% Garantido</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span>🛡️</span><span className="font-semibold">LGPD</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span>📦</span><span className="font-semibold">Rastreamento</span>
                    </div>
                  </div>

                </div>
              </div>{/* end COLUNA DIREITA */}

            </div>{/* end grid */}
          </div>{/* end max-w-7xl */}
        </div>
      </section>

      {/* Modal de Pagamento — aparece ANTES de salvar o pedido */}
      {paymentModal && pendingOrder && (() => {
        const pixPayload = paySettings.pixKey
          ? buildPixPayload({
              key: paySettings.pixKey,
              amount: Number(pendingOrder.total) || 0,
              receiverName: paySettings.pixReceiverName,
              city: paySettings.pixCity,
              txid: String(pendingOrder.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25),
            })
          : '';
        // Converte telefone doméstico (070-XXXX-XXXX) → formato internacional wa.me (81XXXXXXXXXX)
        const waPhone = paySettings.contactPhone
          ? paySettings.contactPhone.replace(/[-\s]/g, '').replace(/^0/, '81')
          : '';
        const waMessage = encodeURIComponent(`Olá! Acabei de fazer o pagamento do pedido ${pendingOrder.id} no valor de ${formatPrice(pendingOrder.total, pendingOrder.currency, localOrder)}. Segue o comprovante:`);
        const whatsappLink = waPhone ? `https://wa.me/${waPhone}?text=${waMessage}` : '';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-card rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b">
                <h2 className="font-bold text-lg text-foreground">Realizar Pagamento</h2>
                <button onClick={() => setPaymentModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-center">
                <p className="text-sm text-muted-foreground">
                  Pedido <span className="font-mono font-bold text-foreground">{pendingOrder.id}</span> — Total: <strong>{formatPrice(pendingOrder.total, pendingOrder.currency, localOrder)}</strong>
                </p>

                {/* PIX */}
                {pendingOrder.paymentMethod === 'pix' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-pink-600 font-extrabold text-base">
                      <Smartphone className="w-5 h-5" /> PAGAMENTO VIA PIX
                    </div>
                    {pixPayload ? (
                      <>
                        <p className="text-sm text-gray-600">Pague <strong>{formatPrice(pendingOrder.total, pendingOrder.currency, localOrder)}</strong> escaneando o QR Code ou copiando a chave abaixo.</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 inline-block">
                          <QRCodeSVG value={pixPayload} size={180} includeMargin />
                        </div>
                        <div className="flex border border-gray-300 rounded-xl overflow-hidden bg-gray-50 max-w-sm mx-auto">
                          <input readOnly value={pixPayload} className="flex-1 px-3 py-2 text-xs font-mono text-gray-500 bg-transparent select-all outline-none" />
                          <button onClick={() => { navigator.clipboard.writeText(pixPayload); setPixCopied(true); setTimeout(() => setPixCopied(false), 2500); }}
                            className="bg-pink-500 hover:bg-pink-600 text-white px-4 flex items-center gap-1.5 text-xs font-bold transition-colors">
                            <Copy className="w-3.5 h-3.5" />{pixCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                        {whatsappLink && (
                          <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
                            <ExternalLink className="w-4 h-4" /> Enviar comprovante no WhatsApp
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
                        Chave PIX não configurada. {paySettings.contactPhone && <>Entre em contato pelo WhatsApp <strong>+{waPhone}</strong>.</>}
                      </div>
                    )}
                  </div>
                )}

                {/* PayPay */}
                {pendingOrder.paymentMethod === 'paypay' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-pink-600 font-extrabold text-base">
                      <Smartphone className="w-5 h-5 animate-pulse" /> PAGAMENTO VIA PAYPAY
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 inline-block">
                      <img src="/products/paypay-qr.png" alt="PayPay QR Code"
                        className="w-52 h-auto rounded-xl border border-gray-200 mx-auto"
                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/200x200/red/white?text=PayPay+QR'; }} />
                    </div>
                    <div className="bg-gray-100 p-3 rounded-xl text-xs font-mono text-left max-w-xs mx-auto space-y-1">
                      <p><strong>Enviar para:</strong> Japan Express</p>
                      {paySettings.contactPhone && <p><strong>Telefone:</strong> {paySettings.contactPhone}</p>}
                      <p><strong>Valor:</strong> {formatPrice(pendingOrder.total, 'JPY')}</p>
                    </div>
                    {paySettings.contactPhone && (
                      <p className="text-xs text-muted-foreground">Após pagar, envie o comprovante no WhatsApp: <strong>{paySettings.contactPhone}</strong></p>
                    )}
                  </div>
                )}

                {/* Yucho */}
                {pendingOrder.paymentMethod === 'yucho' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-pink-600 font-extrabold text-base">
                      <Landmark className="w-5 h-5" /> DEPÓSITO BANCÁRIO (YUCHO)
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-xs text-left space-y-2 max-w-xs mx-auto">
                      <div className="flex justify-between"><span className="text-gray-500">Banco:</span><span className="font-bold">ゆうちょ銀行</span></div>
                      {paySettings.yuchoKigo && <div className="flex justify-between"><span className="text-gray-500">記号:</span><span className="font-bold">{paySettings.yuchoKigo}</span></div>}
                      {paySettings.yuchoNumber && <div className="flex justify-between"><span className="text-gray-500">番号:</span><span className="font-bold">{paySettings.yuchoNumber}</span></div>}
                      {paySettings.yuchoName && <div className="flex justify-between"><span className="text-gray-500">Nome:</span><span className="font-bold">{paySettings.yuchoName}</span></div>}
                    </div>
                    {paySettings.contactPhone && (
                      <p className="text-xs text-muted-foreground">Após o depósito, envie comprovante no WhatsApp: <strong>{paySettings.contactPhone}</strong></p>
                    )}
                  </div>
                )}

                {/* Wise */}
                {pendingOrder.paymentMethod === 'wise' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-extrabold text-base">
                      <WalletIcon className="w-5 h-5" /> PAGAMENTO VIA WISE
                    </div>
                    <p className="text-sm text-muted-foreground">Pague <strong>{formatPrice(pendingOrder.total, pendingOrder.currency, localOrder)}</strong> pelo Wise com câmbio justo.</p>
                    {(pendingOrder.priceBreakdown?.wiseYen ?? 0) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 max-w-xs mx-auto">
                        <p className="text-[11px] text-emerald-700 mb-0.5">No campo <strong>Valor</strong> da Wise, insira:</p>
                        <p className="text-2xl font-black text-emerald-900">¥ {Number(pendingOrder.priceBreakdown?.wiseYen).toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-600">A Wise converte automaticamente</p>
                      </div>
                    )}
                    {paySettings.wiseLink && (
                      <a href={paySettings.wiseLink.startsWith('http') ? paySettings.wiseLink : `https://wise.com/pay/${paySettings.wiseLink.replace(/^@/, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors">
                        <ExternalLink className="w-4 h-4" /> Pagar pelo Wise
                      </a>
                    )}
                    <a href={WISE_INVITE_LINK} target="_blank" rel="noopener noreferrer"
                      className="block text-xs font-semibold text-emerald-700 hover:underline mt-1">
                      🌍 Não tem Wise? Cadastre-se aqui — é rápido e fácil ↗
                    </a>
                  </div>
                )}

                {/* Cartão de Crédito (Stripe) — pagamento confirmado automaticamente */}
                {pendingOrder.paymentMethod === 'card' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-indigo-600 font-extrabold text-base">
                      <CreditCard className="w-5 h-5" /> PAGAMENTO COM CARTÃO
                    </div>
                    <StripeCardForm
                      clientSecret={stripeClientSecret}
                      onSuccess={handleFinalizeOrder}
                    />
                  </div>
                )}

                {pendingOrder.paymentMethod !== 'card' && (
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">Após realizar o pagamento, clique no botão abaixo para registrar seu pedido.</p>
                    <Button onClick={handleFinalizeOrder} className="w-full btn-primary py-4 text-base font-bold rounded-xl gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Já realizei o pagamento — Confirmar Pedido
                    </Button>
                    <button onClick={() => setPaymentModal(false)} className="text-xs text-muted-foreground hover:underline">
                      Voltar e revisar o pedido
                    </button>
                  </div>
                )}
                {pendingOrder.paymentMethod === 'card' && (
                  <button onClick={() => setPaymentModal(false)} className="text-xs text-muted-foreground hover:underline block mx-auto pt-1">
                    Voltar e revisar o pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </Layout>
  );
};

export default OrderReview;
