import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { negotiationService } from '@/services/negotiationService';
import type { Negotiation } from '@/types/negotiation';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext';
import { japanPrefectures } from '@/data/japanPrefectures';
import { getCountryConfig } from '@/data/worldCountries';
import { Coupon } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { usePostalCodeLookup } from '@/hooks/usePostalCodeLookup';
import { useLanguage } from '@/context/LanguageContext';
import { getCurrencyByCountry } from '@/utils/currency';
import { effectiveYen } from '@/utils/pricing';
import { convertYen as fxConvert, getRates } from '@/services/fxService';
import { cartBenefits, computeCheckoutTotals, psFeeUnits } from '@/utils/checkoutTotals';
import { useLocalCart } from '@/hooks/useLocalCart';
import { localOffer, localShippingChoices, localShippingFor, splitCart } from '@/utils/localStock';
import { localCarrierLabel } from '../../shared/local-stock.js';
import { autoApprovablePsDiscountYen, PS_FEE_PER_UNIT_YEN } from '../../shared/money.js';
import { POINTS } from '@/services/pointsService';
import { safeStorage } from '@/utils/storage';
import { checkoutPointsCoverage, psFeeWaiver, PS_FEE_WAIVER_EVENT } from '@/utils/psFeeWaiver';
import { isValidEmail, isValidCPF, isValidPhone, isNonEmpty, maskPhone, runValidations, FieldErrors } from '@/utils/validation';
import { calcImportTax } from '@/utils/taxRules';
import { trackBeginCheckout } from '@/lib/analytics';
import CheckoutOrderSummary from '@/components/checkout/CheckoutOrderSummary';
import CheckoutShippingCalculator from '@/components/checkout/CheckoutShippingCalculator';
import CheckoutShippingAddress from '@/components/checkout/CheckoutShippingAddress';
import CheckoutPersonalInfo from '@/components/checkout/CheckoutPersonalInfo';
import CheckoutNegotiationModal from '@/components/checkout/CheckoutNegotiationModal';
import CheckoutShippingMode from '@/components/checkout/CheckoutShippingMode';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


const Checkout: React.FC = () => {
  // Só o que está marcado no carrinho vai para o pedido.
  const { selectedItems: items, selectedTotalPrice: totalPrice } = useCart();
  const hasTrackedBeginCheckout = useRef(false);

  // Dispara begin_checkout (GA4 + Meta Pixel) uma única vez ao montar a página,
  // apenas se o carrinho não estiver vazio.
  useEffect(() => {
    if (hasTrackedBeginCheckout.current || items.length === 0) return;
    hasTrackedBeginCheckout.current = true;
    trackBeginCheckout(
      'JPY',
      totalPrice,
      items.map((i) => ({
        item_id: i.product.id,
        item_name: i.product.name,
        quantity: i.quantity,
        item_category: i.product.category,
      })),
    );
  }, [items, totalPrice]);
  const { user, isAuthenticated, authReady } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { lookupAddress: lookupJapaneseAddress } = usePostalCodeLookup();
  const { selectedCountry, setSelectedCountry, t } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    postalCode: '',
    prefecture: '', // UF or Province
    city: '',
    address: '',
    building: '',
    country: selectedCountry,
  });

  // Calculate base total price dynamically in correct currency
  const isEuro = ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country);
  const isUsa = formData.country === 'Estados Unidos';
  const currency = getCurrencyByCountry(formData.country);
  // Pedido de estoque local: todos os itens já estão no país do cliente (preço
  // fixo na moeda dele + frete nacional do produto), e ele não pediu envio do Japão.
  const localCart = useLocalCart();
  // Carrinho com itens do país e do Japão é UM pedido só: preço fixo + frete nacional para os de lá,
  // conta do Japão para o resto, os dois fretes somados, tudo na moeda do cliente.
  // Memorizado: `split.japanItems` vai para o calculador de frete, e uma lista nova a cada render o põe em laço.
  const split = useMemo(() => splitCart(items, formData.country), [items, formData.country]);
  const localKind: 'japan' | 'local' | 'mixed' = localCart.forcedJapan ? 'japan' : split.kind;
  const localOrder = localKind === 'local';      // tudo sai do país do cliente
  const mixedOrder = localKind === 'mixed';      // parte de lá, parte do Japão
  const anyLocal = localKind !== 'japan';
  const localItemSet = new Set(anyLocal ? split.localItems : []);
  const isLocalItem = (item: (typeof items)[number]) => localItemSet.has(item);
  // Frete nacional: cadastrado no próprio produto (o maior entre os itens, um pacote só).
  // No Brasil vale a região do cliente (opção "Sul", "Sudeste"…); sem região que combine,
  // ou em país com várias opções, o cliente escolhe.
  const [localShippingChoice, setLocalShippingChoice] = useState('');
  const [shipChoiceOpen, setShipChoiceOpen] = useState(false);
  const localShippingPicked = anyLocal ? localShippingFor(split.localItems, formData.country, formData.prefecture, localShippingChoice) : null;
  const localShippingOptions = anyLocal ? localShippingChoices(split.localItems, formData.country, formData.prefecture) : [];
  const localShippingValue: number | null = localShippingPicked ? localShippingPicked.price : null;
  const unitDisplayOf = (item: (typeof items)[number]) =>
    (isLocalItem(item) ? localOffer(item.product, formData.country)?.price : undefined) ?? fxConvert(effectiveYen(item.product, item.size), currency);

  // Mantém o cupom validado no carrinho ao avançar para o checkout.
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(
    () => (location.state as { coupon?: Coupon } | null)?.coupon || null
  );
  const baseTotalPrice = items.reduce(
    (sum, item) => item.freeGift ? sum : sum + unitDisplayOf(item) * item.quantity, 0
  );
  // Nenhum cupom empilha com desconto do produto/site (mesma regra do servidor, shared/money.js).
  // Em carrinho misto, a base inclui somente itens elegíveis.
  const regularSubtotalForCoupon = items.reduce(
    (sum, item) => {
      const hasProductDiscount = !isLocalItem(item) && (item.product.discountPercent || 0) > 0;
      return (!item.freeGift && !item.product.id.endsWith('_promo') && !hasProductDiscount)
        ? sum + unitDisplayOf(item) * item.quantity
        : sum;
    }, 0
  );
  // (item enviado do país do cliente tem preço fixo: não conta como "com desconto da loja")
  const discountedItemCount = items.filter((item) =>
    !item.freeGift && !isLocalItem(item) && (item.product.id.endsWith('_promo') || (item.product.discountPercent || 0) > 0)
  ).length;
  const [selectedShipping, setSelectedShipping] = useState<{
    carrier: string;
    cost: number;
    costYen: number;
    estimatedDays: string;
  } | null>(null);

  const [deliveryTime, setDeliveryTime] = useState<string>('');

  // Points redemption
  const availablePoints = user?.points || 0;
  const canRedeem = availablePoints >= POINTS.minRedeem;
  const [pointsToUse, setPointsToUse] = useState(0);
  const convertYen = (yen: number) => fxConvert(yen, currency);
  const convertYenExact = (yen: number) => fxConvert(yen, currency, true);
  // Cupom e pontos em ienes pela MESMA conta do servidor (`shared/money.js`):
  // os pontos pagam só a mercadoria que sobra depois do cupom.
  // Base em ¥ para cupom e pontos; no pedido local é o equivalente do preço fixo.
  const localBenefits = anyLocal ? { country: formData.country, currency, shippingDisplay: 0 } : null;
  const couponOnly = cartBenefits(items, appliedCoupon, 0, localBenefits);
  const maxRedeemable = canRedeem
    ? Math.min(availablePoints, Math.floor((couponOnly.productSubtotalYen - couponOnly.couponDiscountYen) / POINTS.yenPerPoint))
    : 0;
  const redeemPoints = Math.max(0, Math.min(pointsToUse, maxRedeemable));
  // Pedido zerado por pontos: resgate cobre toda a mercadoria após cupom.
  // Quando verdadeiro, taxa PS é cobrada cheia (sem negociação nem isenção de popup).
  const pointsCoverAllProducts = cartBenefits(items, appliedCoupon, redeemPoints, localBenefits).pointsCoverAllProducts;

  // O popup global precisa conhecer a cobertura líquida (cupom + pontos) antes
  // de o cliente avançar para a revisão. Sem este sinal ele oferecia zerar a
  // taxa PS porque `redeem_points` só era persistido no botão de avançar.
  useEffect(() => {
    safeStorage.setItem('redeem_points', String(redeemPoints));
    checkoutPointsCoverage.set(pointsCoverAllProducts);
  }, [pointsCoverAllProducts, redeemPoints]);

  // Erros de validação do formulário
  const [errors, setErrors] = useState<FieldErrors>({});

  // PS fee — ¥1000 por unidade comprada (exceto produtos isentos: noPsFee)
  const totalQty = items.reduce((s, i) => i.freeGift ? s : s + i.quantity, 0);
  const psFeeQty = psFeeUnits(items, localBenefits); // item enviado do país do cliente não tem taxa de Personal Shopper
  const psFeeYen = psFeeQty * PS_FEE_PER_UNIT_YEN;
  // Até ¥300 por item sai aprovado na hora pelo servidor; acima, a vendedora decide.
  const maxAutoApprovable = autoApprovablePsDiscountYen(psFeeQty);

  // Isenção da taxa PS pela oferta de saída (exit-intent). Lida uma vez ao montar:
  // se ativa, a taxa de Personal Shopper é zerada nesta visita (ponto 2 do checkout).
  // Reativo: se a isenção for concedida enquanto já estamos no checkout
  // (ex.: aceitar a oferta no popup de saída), o valor atualiza sem remontar.
  const [psFeeWaived, setPsFeeWaived] = useState(() => psFeeWaiver.isActive());
  useEffect(() => {
    const sync = () => setPsFeeWaived(psFeeWaiver.isActive());
    window.addEventListener(PS_FEE_WAIVER_EVENT, sync);
    return () => window.removeEventListener(PS_FEE_WAIVER_EVENT, sync);
  }, []);

  const isGuest = !!location.state?.isGuest;

  // Negociação ativa — carregada APENAS via router state (Continuar pedido ou auto-aprovação).
  // Não usa localStorage no init: assim Ctrl+Shift+R limpa qualquer negociação pendente.
  const [activeNegId, setActiveNegId] = useState<string | null>(location.state?.activeNegId || null);
  const [activeNeg, setActiveNeg] = useState<Negotiation | null>(null);
  const [psFeeDiscountYen, setPsFeeDiscountYen] = useState(0);
  const [shippingDiscountYen, setShippingDiscountYen] = useState(0);

  // Modal de negociação
  const [negModalType, setNegModalType] = useState<'ps_fee' | 'shipping' | null>(null);
  const [negRequest, setNegRequest] = useState('');
  const [negNote, setNegNote] = useState('');
  const [negSubmitting, setNegSubmitting] = useState(false);

  // When the header language/country changes, mirror it into the form.
  // The reverse sync happens in the SELECT's onChange (calls setSelectedCountry directly).
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      country: selectedCountry
    }));
  }, [selectedCountry]);

  // Negociação ativa só é restaurada via localStorage (definido pelo botão "Continuar pedido"
  // no perfil). Não buscamos no Firestore para evitar aplicar descontos de pedidos anteriores.

  // Escuta em tempo real a negociação ativa
  useEffect(() => {
    if (!activeNegId) return;
    return negotiationService.listenById(activeNegId, (neg) => {
      const clearNeg = () => {
        setActiveNegId(null);
        setActiveNeg(null);
        setPsFeeDiscountYen(0);
        setShippingDiscountYen(0);
        localStorage.removeItem('activeNegId');
      };

      // Documento deletado ou negociação inválida → limpa estado
      if (!neg) { clearNeg(); return; }

      // Negociação já usada, rejeitada, expirada ou fora do prazo de 24h → limpa
      if (
        neg.status === 'used' ||
        neg.status === 'rejected' ||
        neg.status === 'expired' ||
        new Date(neg.expiresAt) < new Date()
      ) {
        clearNeg();
        return;
      }

      setActiveNeg(neg);
      if ((neg.status === 'approved' || neg.status === 'auto_approved') && neg.approvedDiscountYen != null) {
        if (neg.type === 'ps_fee') setPsFeeDiscountYen(neg.approvedDiscountYen);
        else setShippingDiscountYen(neg.approvedDiscountYen);
      }
      // Auto-expire LOCAL: quando o prazo estourou, a UI já trata como expirada
      // (o clearNeg acima dispara pelo teste de data em neg.expiresAt). A escrita
      // do status 'expired' no Firestore fica com o painel admin
      // (NegotiationManager, sob sessão admin): a regra de update de
      // /negotiations/ proíbe o cliente mudar status (só libera clientSeen), então
      // tentar gravar 'expired' daqui seria sempre rejeitado pelo Firebase.
    });
  }, [activeNegId]);

  // Aplica um cupom do perfil (já validado pelo CouponSelector)
  // O desconto (e o frete grátis) sai da conta única abaixo, a partir do
  // próprio cupom — o valor que o CouponSelector mostra é só prévia.
  const handleCouponApply = (coupon: Coupon) => {
    setAppliedCoupon(coupon);
  };

  const handleCouponRemove = () => {
    setAppliedCoupon(null);
  };

  // Load from state if returning from order-review page
  useEffect(() => {
    if (location.state?.formData) {
      setFormData(location.state.formData);
    }
  }, [location.state]);

  // Pré-aplica o cupom escolhido no carrinho (uma única vez)
  const cartCouponApplied = useRef(false);
  useEffect(() => {
    const cartCoupon = location.state?.coupon as Coupon | undefined;
    if (!cartCouponApplied.current && cartCoupon && baseTotalPrice > 0) {
      cartCouponApplied.current = true;
      setAppliedCoupon(cartCoupon);
    }
  }, [location.state, baseTotalPrice]);

  // Auto-populate from user profile if authenticated
  useEffect(() => {
    if (isAuthenticated && user && !location.state?.formData) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        cpf: user.cpf || '',
        postalCode: user.address?.postalCode || '',
        prefecture: user.address?.prefecture || '',
        city: user.address?.city || '',
        address: user.address?.address || '',
        building: user.address?.building || '',
        country: selectedCountry,
      });
    }
  }, [isAuthenticated, user, location.state, selectedCountry]);

  // Exige login — pedido sem conta não é salvo no Firestore e o admin nunca vê
  useEffect(() => {
    if (authReady && !isAuthenticated && !isGuest) {
      navigate('/cadastro', { state: { from: '/checkout' } });
    }
  }, [isAuthenticated, authReady, navigate, isGuest]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/carrinho');
    }
  }, [items.length, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'phone' ? maskPhone(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Auto address lookup by CEP/Postal Code
  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Lê o país do DOM diretamente para evitar closure stale quando o país acabou de mudar
    const countrySelect = document.getElementById('country') as HTMLSelectElement | null;
    const currentCountry = countrySelect?.value || formData.country;

    if (currentCountry === 'Japão') {
      const cleanVal = val.replace(/[-\s]/g, '').slice(0, 7);
      let formatted = cleanVal;
      if (cleanVal.length > 3) {
        formatted = `${cleanVal.slice(0, 3)}-${cleanVal.slice(3, 7)}`;
      }
      setFormData(prev => ({ ...prev, postalCode: formatted }));

      if (cleanVal.length === 7) {
        try {
          const result = await lookupJapaneseAddress(cleanVal);
          if (result) {
            // Map the Japanese province name (e.g. "三重県") to the Portuguese identifier (e.g. "Mie")
            const matchedPref = japanPrefectures.find(p => p.nameJa === result.province);
            setFormData(prev => ({
              ...prev,
              prefecture: matchedPref ? matchedPref.name : '',
              city: result.city,
              address: result.town,
            }));
            toast({
              title: "Código Postal Encontrado!",
              description: `${result.province} ${result.city} ${result.town}`,
            });
          } else {
            toast({
              title: "Erro no Código Postal",
              description: "Não foi possível localizar este endereço japonês.",
              variant: "destructive",
            });
          }
        } catch (error) {
          devError('Erro ao buscar CEP japonês:', error);
        }
      }
    } else if (currentCountry === 'Brasil') {
      const cleanVal = val.replace(/\D/g, '').slice(0, 8);
      let formatted = cleanVal;
      if (cleanVal.length > 5) {
        formatted = `${cleanVal.slice(0, 5)}-${cleanVal.slice(5, 8)}`;
      }
      setFormData(prev => ({ ...prev, postalCode: formatted }));

      if (cleanVal.length === 8) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanVal}/json/`, { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await response.json();

          if (response.ok && !data.erro) {
            const stateCode = data.uf || '';
            const addressString = data.logradouro
              ? `${data.logradouro}${data.bairro ? `, Bairro: ${data.bairro}` : ''}`
              : '';
            setFormData(prev => ({
              ...prev,
              prefecture: stateCode,
              city: data.localidade || '',
              address: addressString,
            }));
            toast({ title: "CEP Encontrado!", description: `${data.localidade} - ${stateCode}` });
          } else {
            toast({ title: "CEP não encontrado", description: "Preencha o endereço manualmente.", variant: "destructive" });
          }
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            toast({ title: "ViaCEP indisponível", description: "Serviço lento — preencha o endereço manualmente.", variant: "destructive" });
          } else {
            devError('Erro ao buscar CEP:', error);
          }
        }
      }
    } else if (getCountryConfig(currentCountry)?.zipLookup) {
      // Busca via zippopotam.us (gratuito) — todos os países da tabela com zipLookup
      const cfg = getCountryConfig(currentCountry)!;
      const cc = cfg.iso.toUpperCase();
      const isUsState = currentCountry === 'Estados Unidos';

      // Formatação: Portugal XXXX-XXX; demais mantém o que o usuário digitou (formatos variam por país)
      let formatted = val;
      if (currentCountry === 'Portugal') {
        const digits = val.replace(/\D/g, '').slice(0, 7);
        formatted = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
      } else if (['Estados Unidos', 'França', 'Itália', 'Espanha', 'Alemanha'].includes(currentCountry)) {
        formatted = val.replace(/\D/g, '').slice(0, 5);
      } else {
        formatted = val.trim().slice(0, 12); // outros países: CEP alfanumérico (UK, CA, etc.)
      }
      setFormData(prev => ({ ...prev, postalCode: formatted }));

      // Dispara a busca quando o CEP parece completo (>= 3 chars). Trata erro silencioso.
      const probe = formatted.replace(/\s/g, '');
      if (probe.length >= 3) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
          const res = await fetch(
            `https://api.zippopotam.us/${cc}/${encodeURIComponent(formatted)}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const place = data.places?.[0];
            if (place) {
              const stateValue = isUsState
                ? (place['state abbreviation'] || place['state'] || '')
                : (place['state'] || '');
              setFormData(prev => ({
                ...prev,
                city: place['place name'] || prev.city,
                prefecture: stateValue || prev.prefecture,
              }));
              toast({
                title: 'Código Postal Encontrado!',
                description: `${place['place name']} — ${place['state']}`,
              });
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name !== 'AbortError') {
            devError('Erro ao buscar código postal:', error);
          }
        }
      }
    } else {
      setFormData(prev => ({ ...prev, postalCode: val }));
    }
  };

  // CPF Input formatting
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = val;
    if (val.length > 9) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}-${val.slice(9, 11)}`;
    } else if (val.length > 6) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}.${val.slice(6, 9)}`;
    } else if (val.length > 3) {
      formatted = `${val.slice(0, 3)}.${val.slice(3, 6)}`;
    }
    setFormData(prev => ({ ...prev, cpf: formatted }));
    if (errors.cpf) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.cpf;
        return next;
      });
    }
  };

  const handleNegotiationSubmit = async () => {
    if (!negModalType) return;
    // Antes o botão não fazia nada para convidado: a negociação fica ligada à
    // conta (é por ela que o desconto chega ao pedido).
    if (!user || isGuest) {
      toast({
        title: 'Entre na sua conta para pedir desconto',
        description: 'A negociação fica ligada à sua conta. Compra como convidado não tem negociação.',
        variant: 'destructive',
      });
      return;
    }
    const requestedYen = parseInt(negRequest, 10) || 0;
    if (requestedYen <= 0) {
      toast({ title: 'Informe o desconto desejado em ienes', variant: 'destructive' });
      return;
    }
    const originalYen = negModalType === 'ps_fee' ? psFeeYen : (selectedShipping?.costYen || 0);
    if (requestedYen >= originalYen) {
      toast({ title: 'O desconto não pode ser igual ou maior que o valor total', variant: 'destructive' });
      return;
    }
    setNegSubmitting(true);
    try {
      // Freeze the exchange rate at this exact moment so approved ¥ → R$ never drifts
      const rates = getRates();
      const frozenRate = currency === 'EUR' ? rates.EUR : currency === 'USD' ? rates.USD : currency === 'JPY' ? 1 : rates.BRL;

      const neg = await negotiationService.create({
        userName: user.name || '',
        cartItems: items.filter(i => !i.freeGift).map(i => ({
          productId: i.product.id,
          productName: i.product.name || '',
          productImage: i.product.image || '',
          size: i.size || '',
          variantLabel: i.variantLabel || '',
          quantity: i.quantity,
          priceYen: effectiveYen(i.product, i.size),
        })),
        checkoutForm: {
          name: formData.name || '',
          email: formData.email || '',
          phone: formData.phone || '',
          cpf: formData.cpf || '',
          postalCode: formData.postalCode || '',
          prefecture: formData.prefecture || '',
          city: formData.city || '',
          address: formData.address || '',
          building: formData.building || '',
          country: formData.country || '',
        },
        shipping: selectedShipping ? {
          carrier: selectedShipping.carrier || '',
          cost: selectedShipping.cost ?? 0,
          costYen: selectedShipping.costYen ?? 0,
          estimatedDays: selectedShipping.estimatedDays || '',
        } : null,
        deliveryTime: deliveryTime || '',
        currency,
        exchangeRateAtCreation: frozenRate ?? 0,
        type: negModalType,
        originalAmountYen: originalYen,
        numUnits: psFeeQty,
        requestedDiscountYen: requestedYen,
        clientNote: negNote || '',
      });
      setActiveNegId(neg.id);
      setActiveNeg(neg);
      // Taxa PS dentro do teto: o SERVIDOR aprova na hora, conferindo o
      // carrinho pelo catálogo. A tela prometia "sai aprovado na hora", mas
      // ninguém aprovava — o pedido ficava esperando a vendedora. O listener
      // acima pega o novo status e aplica o desconto.
      let autoApproved = false;
      if (negModalType === 'ps_fee' && requestedYen <= maxAutoApprovable) {
        try {
          const result = await negotiationService.requestAutoApproval(neg.id);
          autoApproved = result.status === 'auto_approved';
        } catch (approvalError) {
          devWarn('Aprovação automática indisponível; fica para a vendedora:', approvalError);
        }
      }
      toast(autoApproved
        ? { title: '✅ Desconto aprovado!', description: `¥${requestedYen.toLocaleString()} de desconto na taxa Personal Shopper.` }
        : { title: '📩 Solicitação enviada!', description: 'A vendedora irá analisar e responder em breve.' });
      setNegModalType(null);
      setNegRequest('');
      setNegNote('');
    } catch (err) {
      devError('Erro ao criar negociação:', err);
      toast({
        title: 'Erro ao enviar solicitação',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
    setNegSubmitting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Valida os campos do formulário
    const fieldErrors = runValidations({
      name: () => (isNonEmpty(formData.name, 2) ? null : 'Informe o nome completo.'),
      email: () => (isValidEmail(formData.email) ? null : 'E-mail inválido.'),
      phone: () => (isValidPhone(formData.phone) ? null : 'Telefone inválido.'),
      cpf: () =>
        formData.country === 'Brasil'
          ? isValidCPF(formData.cpf)
            ? null
            : 'CPF inválido (verifique os dígitos).'
          : null,
      postalCode: () => (isNonEmpty(formData.postalCode, 4) ? null : 'Informe o código postal.'),
      prefecture: () => (isNonEmpty(formData.prefecture) ? null : 'Selecione o estado/província.'),
      city: () => (isNonEmpty(formData.city) ? null : 'Informe a cidade.'),
      address: () => (isNonEmpty(formData.address, 3) ? null : 'Informe a rua e número.'),
    });
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      toast({
        title: 'Confira os campos destacados',
        description: 'Alguns dados precisam de correção antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedShipping || (anyLocal && localShippingValue === null)) {
      toast({
        title: "Método de envio pendente",
        description: "Por favor, selecione uma forma de entrega.",
        variant: "destructive",
      });
      return;
    }

    // Navigate to order review page
    safeStorage.setItem('redeem_points', String(redeemPoints));
    navigate('/order-review', {
      state: {
        formData,
        shipping: selectedShipping,
        deliveryTime,
        coupon: appliedCoupon,
        couponDiscount: shown.couponDiscount,
        psFeeYen,
        psFeeDiscountYen: effectivePsFeeDiscountYen,  // capped to current cart — anti-manipulation
        shippingDiscountYen: localOrder ? 0 : shippingDiscountYen,
        negotiationId: localOrder ? null : activeNegId,
        isGuest,
        // Pedido de estoque local: a revisão manda isto ao servidor e refaz a conta com o frete nacional.
        fulfillment: anyLocal ? 'local' : 'japan',
        localKind,
        localShippingDisplay: anyLocal ? localShippingValue : null,
        localShippingChoice: anyLocal ? localShippingPicked?.name || '' : '',
      }
    });
  };

  // Saiu do pedido todo do país do cliente para envio do Japão: o frete nacional escolhido sozinho não vale mais.
  const wasLocalOrder = useRef(localOrder);
  useEffect(() => {
    if (wasLocalOrder.current && !localOrder) setSelectedShipping(null);
    wasLocalOrder.current = localOrder;
  }, [localOrder]);

  // Frete nacional: já vem do produto, então fica escolhido sozinho.
  useEffect(() => {
    if (!localOrder) return;
    setSelectedShipping(localShippingValue === null ? null : {
      carrier: `${localCarrierLabel(formData.country) as string}${localShippingPicked && localShippingOptions.length > 1 ? ` • ${localShippingPicked.name}` : ''}`,
      cost: localShippingValue,
      costYen: 0,
      estimatedDays: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOrder, localShippingValue, localShippingPicked?.name, formData.country]);

  // A conta inteira pela MESMA função do servidor (`shared/money.js`): cada
  // linha é um valor inteiro na moeda do cliente e o total é a soma delas.
  // Antes esta tela somava valores com centavos e o servidor cobrava outro
  // número (além de um desconto de 5% que ninguém via).
  // Frete em ¥: no Japão a calculadora já entrega ¥ (e zera acima do mínimo).
  const shippingYenBase = selectedShipping
    ? (currency === 'JPY' ? selectedShipping.cost : selectedShipping.costYen) || 0
    : 0;
  const negotiatedPsFee = activeNeg?.type === 'ps_fee' && (activeNeg.status === 'approved' || activeNeg.status === 'auto_approved')
    ? { status: activeNeg.status, approvedDiscountYen: psFeeDiscountYen }
    : null;
  const totals = computeCheckoutTotals({
    items,
    currency,
    country: formData.country,
    coupon: appliedCoupon,
    redeemPoints,
    shippingYen: shippingYenBase,
    shippingDiscountYen,
    psFeeWaived,
    negotiatedPsFee,
    local: anyLocal ? { country: formData.country, currency, shippingDisplay: localShippingValue ?? 0 } : null,
  });
  const { shown } = totals;
  const couponDiscount = shown.couponDiscount;
  const pointsDiscount = shown.pointsDiscount;
  // Oferta de saída isenta a taxa por completo e tem prioridade sobre a negociação
  // (limitada ao valor real da taxa — nunca desconta mais do que a taxa atual).
  const effectivePsFeeDiscountYen = totals.psFeeDiscountYen;
  const psFeeFinalYen = totals.psFeeFinalYen;
  const psFeeDisplay = shown.psFee;
  const psFeeOriginalDisplay = convertYenExact(psFeeYen);
  const actualShippingCost = shown.shipping;
  const shippingOriginalDisplay = convertYen(shippingYenBase);
  const shippingDiscountDisplay = Math.max(0, shippingOriginalDisplay - shown.shipping);

  // Tax estimates shown as warning only — NOT added to grandTotal
  let estimatedTax = 0;
  let taxLabel = '';

  {
    const r = calcImportTax(shown.products, formData.country, formData.prefecture);
    estimatedTax = r.tax;
    taxLabel = r.label;
  }

  // O que o cliente paga. Imposto estimado fica fora; o dos EUA é pré-pago
  // (DDP) e já está aqui como linha própria.
  const grandTotal = shown.total;
  const totalSavings = couponDiscount + pointsDiscount
    + Math.max(0, psFeeOriginalDisplay - psFeeDisplay)
    + shippingDiscountDisplay;

  // Check expiry (client-side) — purely derived, no side-effects here
  const negIsExpired = activeNeg ? negotiationService.isExpired(activeNeg) : false;

  const negIsPending = activeNeg?.status === 'pending' && !negIsExpired;
  const negIsApproved = activeNeg?.status === 'approved' || activeNeg?.status === 'auto_approved';
  const negIsRejected = activeNeg?.status === 'rejected';
  const negActuallyExpired = activeNeg?.status === 'expired' || negIsExpired;

  return (
    <Layout>
      <CheckoutShippingMode
        shipChoiceOpen={shipChoiceOpen}
        split={split}
        formData={formData}
        setShipChoiceOpen={setShipChoiceOpen}
        localKind={localKind}
      />
      <CheckoutNegotiationModal
        negModalType={negModalType}
        setNegModalType={setNegModalType}
        setNegRequest={setNegRequest}
        setNegNote={setNegNote}
        psFeeQty={psFeeQty}
        psFeeYen={psFeeYen}
        selectedShipping={selectedShipping}
        maxAutoApprovable={maxAutoApprovable}
        negRequest={negRequest}
        negNote={negNote}
        handleNegotiationSubmit={handleNegotiationSubmit}
        negSubmitting={negSubmitting}
      />
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto min-w-0">
            {/* Checkout Form */}
            <div className="lg:col-span-2 min-w-0">
              <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-sans text-xl font-bold text-foreground">
                    Dados para Entrega
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {isGuest && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <span className="text-base shrink-0">👤</span>
                      <span>
                        <strong>Compra como Convidado</strong> — Sem pontos, cupons ou histórico de pedidos.{' '}
                        <button type="button" onClick={() => navigate('/cadastro')} className="underline ml-1 font-semibold hover:text-amber-900">Criar conta</button> para aproveitar todos os benefícios.
                      </span>
                    </div>
                  )}

                  <CheckoutPersonalInfo
                    formData={formData}
                    handleInputChange={handleInputChange}
                    errors={errors}
                    handleCpfChange={handleCpfChange}
                  />
                  <CheckoutShippingAddress
                    formData={formData}
                    setSelectedCountry={setSelectedCountry}
                    setFormData={setFormData}
                    handlePostalCodeChange={handlePostalCodeChange}
                    handleInputChange={handleInputChange}
                    errors={errors}
                  />
                  <CheckoutShippingCalculator
                    anyLocal={anyLocal}
                    mixedOrder={mixedOrder}
                    formData={formData}
                    localShippingValue={localShippingValue}
                    localShippingPicked={localShippingPicked}
                    localShippingOptions={localShippingOptions}
                    currency={currency}
                    localShippingChoice={localShippingChoice}
                    setLocalShippingChoice={setLocalShippingChoice}
                    localOrder={localOrder}
                    setSelectedShipping={setSelectedShipping}
                    couponDiscount={couponDiscount}
                    split={split}
                    negIsPending={negIsPending}
                    negActuallyExpired={negActuallyExpired}
                    setActiveNegId={setActiveNegId}
                    setPsFeeDiscountYen={setPsFeeDiscountYen}
                    setShippingDiscountYen={setShippingDiscountYen}
                    selectedShipping={selectedShipping}
                  />
                </form>
              </div>
            </div>

            <CheckoutOrderSummary
              split={split}
              setShipChoiceOpen={setShipChoiceOpen}
              localKind={localKind}
              mixedOrder={mixedOrder}
              formData={formData}
              items={items}
              unitDisplayOf={unitDisplayOf}
              isLocalItem={isLocalItem}
              currency={currency}
              appliedCoupon={appliedCoupon}
              regularSubtotalForCoupon={regularSubtotalForCoupon}
              couponDiscount={couponDiscount}
              discountedItemCount={discountedItemCount}
              handleCouponApply={handleCouponApply}
              handleCouponRemove={handleCouponRemove}
              isAuthenticated={isAuthenticated}
              isGuest={isGuest}
              canRedeem={canRedeem}
              availablePoints={availablePoints}
              maxRedeemable={maxRedeemable}
              pointsToUse={pointsToUse}
              setPointsToUse={setPointsToUse}
              redeemPoints={redeemPoints}
              shown={shown}
              anyLocal={anyLocal}
              pointsDiscount={pointsDiscount}
              estimatedTax={estimatedTax}
              taxLabel={taxLabel}
              localShippingValue={localShippingValue}
              localOrder={localOrder}
              selectedShipping={selectedShipping}
              actualShippingCost={actualShippingCost}
              totalQty={totalQty}
              effectivePsFeeDiscountYen={effectivePsFeeDiscountYen}
              psFeeYen={psFeeYen}
              psFeeOriginalDisplay={psFeeOriginalDisplay}
              psFeeFinalYen={psFeeFinalYen}
              psFeeDisplay={psFeeDisplay}
              psFeeQty={psFeeQty}
              psFeeWaived={psFeeWaived}
              negIsApproved={negIsApproved}
              activeNeg={activeNeg}
              negIsPending={negIsPending}
              negIsRejected={negIsRejected}
              negActuallyExpired={negActuallyExpired}
              pointsCoverAllProducts={pointsCoverAllProducts}
              setNegModalType={setNegModalType}
              maxAutoApprovable={maxAutoApprovable}
              shippingDiscountYen={shippingDiscountYen}
              shippingDiscountDisplay={shippingDiscountDisplay}
              totalSavings={totalSavings}
              grandTotal={grandTotal}
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Checkout;
