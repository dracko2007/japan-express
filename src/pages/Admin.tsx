import { safeStorage } from '@/utils/storage';
import { fmtOrderMoney, fmtPair, itemPhoto, orderTotalYen, orderYenView, yen } from '@/utils/adminOrderMoney';
import React, { Suspense, lazy, useCallback, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Printer, ShoppingBag, User, MapPin, Phone, Mail, Calendar, TestTube, Tag, Truck, CheckCircle, XCircle, Trash2, BarChart3, Users, PackagePlus, Video, Megaphone, Clapperboard, Building2, Sparkles, ShieldCheck, Calculator, CloudUpload, FileText, Handshake, Flag, TrendingDown, MessageCircle, Trophy, Landmark } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { emailService } from '@/services/emailService';
import { emailServiceSimple } from '@/services/emailServiceSimple';
import { whatsappServiceSimple } from '@/services/whatsappServiceSimple';
import { waServer } from '@/services/waServerService';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { orderService } from '@/services/orderService';
import type { OrderPageCursor } from '@/services/firebaseSyncService';
import { customRequestService } from '@/services/customRequestService';
import { customerService } from '@/services/customerService';
import { useConfirm } from '@/components/ConfirmDialog';
import { negotiationService } from '@/services/negotiationService';
import { COMPANY_PROFILE } from '@/config/companyProfile';
import { ADMIN_EMAIL } from '@/config/admin';
import { auth } from '@/config/firebase';
import { affiliateService } from '@/services/affiliateService';
import { trackingUrlFor } from '@/utils/trackingUrl';
import type { Order, OrderItem } from '@/types';
import { formatPrice } from '@/utils/currency';
import { localCarrierLabel } from '../../shared/local-stock.js';
import { printOrder, printShippingLabel } from '@/utils/adminOrderPrint';
import { escapeHtml, isLocalOrder, isMixedOrder, carrierText, localShippingText } from '@/components/admin/orderHelpers';
import { ADMIN_TABS, isAdminTab, type AdminTab, type AdminTabItem } from '@/components/admin/adminTabs';
import TabLoading from '@/components/admin/TabLoading';
import AdminOrdersList from '@/components/admin/AdminOrdersList';
import AdminOrderStats from '@/components/admin/AdminOrderStats';
import AdminNotificationTest from '@/components/admin/AdminNotificationTest';
import AdminMobileNav from '@/components/admin/AdminMobileNav';
import AdminSidebar from '@/components/admin/AdminSidebar';

// Cada aba (e os modais dos pedidos) só baixa quando é aberta: antes as ~30
// telas vinham juntas num pacote de ~940 KB, pesado para abrir no celular.
const CouponManager = lazy(() => import('@/components/admin/CouponManager'));
const AffiliateManager = lazy(() => import('@/components/admin/AffiliateManager'));
const Dashboard = lazy(() => import('@/components/admin/Dashboard'));
const CustomerList = lazy(() => import('@/components/admin/CustomerList'));
const ProductManager = lazy(() => import('@/components/admin/ProductManager'));
const HomeContentManager = lazy(() => import('@/components/admin/HomeContentManager'));
const VlogManager = lazy(() => import('@/components/admin/VlogManager'));
const CustomRequestManager = lazy(() => import('@/components/admin/CustomRequestManager'));
const B2BRequestManager = lazy(() => import('@/components/admin/B2BRequestManager'));
const AdminAccessManager = lazy(() => import('@/components/admin/AdminAccessManager'));
const CN23Modal = lazy(() => import('@/components/admin/CN23Modal'));
const ImageMigration = lazy(() => import('@/components/admin/ImageMigration'));
const PromotionManager = lazy(() => import('@/components/admin/PromotionManager'));
const NegotiationManager = lazy(() => import('@/components/admin/NegotiationManager'));
const TrackingModal = lazy(() => import('@/components/admin/TrackingModal'));
const AdminCalculator = lazy(() => import('@/components/admin/AdminCalculator'));
const MarketingManager = lazy(() => import('@/components/admin/MarketingManager'));
const EmployeeManager = lazy(() => import('@/components/admin/EmployeeManager'));
const CouponUsageReport = lazy(() => import('@/components/admin/CouponUsageReport'));
const FraudDashboard = lazy(() => import('@/components/admin/FraudDashboard'));
const ThermalPrinterSettings = lazy(() => import('@/components/admin/ThermalPrinterSettings'));
const WhatsAppSettings = lazy(() => import('@/components/admin/WhatsAppSettings'));
const VisitorStats = lazy(() => import('@/components/admin/VisitorStats'));
const ReviewModeration = lazy(() => import('@/components/admin/ReviewModeration'));
const MarginAudit = lazy(() => import('@/components/admin/MarginAudit'));
const FinanceDetailManager = lazy(() => import('@/components/admin/FinanceDetailManager'));
const CheckoutSandbox = lazy(() => import('@/components/admin/CheckoutSandbox'));
const PromoNotificationModal = lazy(() => import('@/components/admin/PromoNotificationModal'));
const VideoReviewManager = lazy(() => import('@/components/admin/VideoReviewManager'));
const SorteioManager = lazy(() => import('@/components/admin/SorteioManager'));

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};



const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, permissions, authReady } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersCursor, setOrdersCursor] = useState<OrderPageCursor | null>(null);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
  const [affiliatePendingCount, setAffiliatePendingCount] = useState(0);
  const [newCustomers, setNewCustomers] = useState(0);
  const [newRequests, setNewRequests] = useState(0);
  const [pendingAffiliateRequestsCount, setPendingAffiliateRequestsCount] = useState(0);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0); // vídeos de review aguardando aprovação
  const [isTesting, setIsTesting] = useState(false);
  // A aba fica no endereço (?aba=pedidos…): recarregar a página ou voltar
  // no navegador mantém o lugar, e dá para mandar o link de uma aba.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('aba');
  const requestedTab: AdminTab = isAdminTab(tabParam) ? tabParam : 'dashboard';
  const activeTab: AdminTab = requestedTab === 'admins' && !permissions.canManageAdmins ? 'dashboard' : requestedTab;
  const setActiveTab = useCallback((tab: AdminTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === 'dashboard') next.delete('aba');
      else next.set('aba', tab);
      return next;
    });
  }, [setSearchParams]);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cn23Order, setCn23Order] = useState<Order | null>(null);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [pendingNegotiationsCount, setPendingNegotiationsCount] = useState(0);
  // Sem sessão no Firebase (expirada, ou nunca aberta neste navegador): nenhuma
  // leitura protegida vai passar até entrar de novo.
  const [noAdminSession, setNoAdminSession] = useState(false);
  const { settings, saveSettings } = useSiteSettings();

  // A lista cresce em páginas reais do Firestore; nenhum carregamento integral é feito no navegador.

  // `ADMIN_EMAIL` (de @/config/admin) é só o destinatário do e-mail de teste
  // desta tela. Quem barra o acesso é o guarda de sessão mais abaixo somado às
  // regras do Firestore — o comentário antigo dizia que era esta constante, o
  // que fazia parecer que apagá-la abriria o painel.

  useEffect(() => {
    // Espera o SDK resolver o estado inicial antes de qualquer leitura. Pedidos
    // e contagem de clientes exigem token de admin nas regras do Firestore:
    // disparados antes da sessão existir voltam permission-denied — e ninguém
    // refaz a consulta sozinho depois.
    if (!authReady) return;
    if (!auth?.currentUser) {
      setNoAdminSession(true);
      setOrdersLoading(false);
      return;
    }
    setNoAdminSession(false);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = 0;
    const MIN_INTERVAL_MS = 10_000; // no mínimo 10s entre refreshes
    // 30s com o painel aberto custava ~40 mil leituras/hora e esgotava sozinho
    // a cota diária do Firestore em pouco mais de UMA HORA — foi o que
    // derrubou a loja em 26/07/2026. O painel não precisa de tempo real:
    // trocar de aba já dispara um refresh pelo `visibilitychange`.
    const POLL_MS = 5 * 60 * 1000;

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh < MIN_INTERVAL_MS) return; // throttle
      // Sem isto a trava nunca valia: cada foco/volta à aba relia tudo.
      lastRefresh = now;
      loadOrders();
      loadCustomers();
      affiliateService.getPendingCommissions()
        .then((items) => setAffiliatePendingCount(items.length))
        .catch(() => setAffiliatePendingCount(0));
      affiliateService.getRequests('pending')
        .then((items) => setPendingAffiliateRequestsCount(items.length))
        .catch(() => setPendingAffiliateRequestsCount(0));
      affiliateService.getAllReviews()
        .then((items) => setPendingReviewsCount(items.filter((item) => item.status === 'pending').length))
        .catch(() => setPendingReviewsCount(0));
    };

    const debouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, 300);
    };

    refresh();

    // Só consulta com a aba à vista. Antes o intervalo seguia disparando em
    // segundo plano: uma aba esquecida queimava a cota sem ninguém olhando.
    const pollVisivel = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    const interval = setInterval(pollVisivel, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') debouncedRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', debouncedRefresh);

    return () => {
      clearInterval(interval);
      clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', debouncedRefresh);
    };
  }, [user, navigate, authReady]);

  useEffect(() => {
    // `onSnapshot` sem sessão erra na primeira resposta e não se reinscreve:
    // o contador de negociações ficaria zerado o resto da sessão.
    if (!authReady || !auth?.currentUser) return;
    // Só as pendentes: o sino precisa do número, não da coleção inteira.
    return negotiationService.listenPending((pendentes) => {
      setPendingNegotiationsCount(pendentes.length);
    });
  }, [authReady]);

  const loadOrders = async (append = false) => {
    if (append && (!ordersHasMore || ordersLoadingMore)) return;

    if (append) setOrdersLoadingMore(true);
    else setOrdersLoading(true);
    try {
      const page = await orderService.getOrdersPage(20, append ? ordersCursor : null);
      setAllOrders((current) => {
        if (!append) return page.items;
        const known = new Set(current.map((order) => order.orderNumber || order.id));
        return [...current, ...page.items.filter((order) => !known.has(order.orderNumber || order.id))];
      });
      setOrdersCursor(page.nextCursor);
      setOrdersHasMore(page.hasMore);
    } catch (error) {
      devError('[ADMIN] Falha ao carregar pedidos:', error);
      if (!append) {
        setAllOrders([]);
        setOrdersCursor(null);
        setOrdersHasMore(false);
      }
      toast({
        title: 'Erro ao carregar pedidos',
        description: auth?.currentUser
          ? 'Não foi possível consultar o Firestore. Tente novamente.'
          : 'Sua sessão de admin não está ativa. Entre novamente para ver os pedidos.',
        variant: 'destructive',
      });
    } finally {
      if (append) setOrdersLoadingMore(false);
      else setOrdersLoading(false);
    }
  };

  // Só o número aparece aqui (contador + badge de novos). Buscar a lista
  // completa para depois usar `.length` custava a leitura das coleções `users`
  // e `orders` inteiras a cada ciclo; a agregação custa ~1 leitura.
  const loadCustomers = async () => {
    try {
      const total = await customerService.getCustomerCount();
      setCustomerCount(total);
      const seenRaw = safeStorage.getItem('admin_seen_customers');
      const seen = seenRaw == null ? null : parseInt(seenRaw, 10);
      if (seen == null || isNaN(seen)) {
        safeStorage.setItem('admin_seen_customers', String(total)); // 1ª vez: sem badge
        setNewCustomers(0);
      } else {
        setNewCustomers(Math.max(0, total - seen));
      }
    } catch (e) {
      devWarn('[admin] contagem de clientes falhou:', e);
    }
  };

  // Pedidos personalizados a processar. O próprio `status` já é o controle, e é
  // ele que o badge conta — não um "visto" guardado no storage.
  //
  // Um badge por "visto" tem exatamente a falha que motivou este pedido: na
  // PRIMEIRA carga ele grava visto = pendentes e mostra zero, escondendo o
  // trabalho que já estava parado (o dono tinha 2 pedidos sem resposta e o
  // painel não indicava nada). O mesmo acontece toda vez que o storage é
  // limpo, ou em outro navegador. Contando `status === 'new'`, o badge só
  // apaga quando o pedido vira 'quoted'/'closed' — ou seja, quando alguém de
  // fato tratou dele.
  const loadCustomRequests = async () => {
    try {
      setNewRequests(await customRequestService.getPendingCount());
    } catch (e) {
      devWarn('[admin] contagem de pedidos personalizados falhou:', e);
    }
  };

  // Pedidos a processar (= novos): tudo que não foi enviado/entregue/cancelado.
  // Robusto a variações de status ('pending', 'Pendente', 'paid', 'processing'...).
  // Única fonte de "pendente" nesta tela — reaproveitada tanto pelo badge do
  // menu (linha ~750) quanto pelo card "Pendentes carregados" (aba
  // Notificações) — para não voltar a ter 2 lógicas divergentes (uma delas
  // comparava com o literal solto 'pending', que nenhum pedido real usa, e
  // sempre mostrava 0). Calculado sobre `allOrders`, que é paginado: reflete
  // só os pedidos já carregados no navegador, não o total do banco.
  const DONE_STATUSES = ['shipped', 'delivered', 'cancelled', 'enviado', 'entregue', 'cancelado'];
  const pendingOrdersCount = allOrders.filter(
    (o) => !DONE_STATUSES.includes(String(o.status || 'pending').toLowerCase())
  ).length;

  // Ao abrir a aba Clientes, marca todos como vistos (zera o badge)
  useEffect(() => {
    if (activeTab === 'customers' && customerCount > 0) {
      safeStorage.setItem('admin_seen_customers', String(customerCount));
      setNewCustomers(0);
    }
  }, [activeTab, customerCount]);

  const handleConfirmPayment = async (orderNumber: string) => {
    if (!user?.email) {
      toast({ title: "Erro", description: "Email do admin não encontrado", variant: "destructive" });
      return;
    }
    // Confirma pagamento E muda status para 'confirmed' (etapa 1)
    const success = await orderService.confirmPayment(orderNumber, user.email);
    if (success) {
      toast({
        title: "✅ Pagamento confirmado!",
        description: `Pedido ${orderNumber} marcado como pago e pronto para processar.`,
      });
      // Avisa o cliente que o pagamento foi confirmado (preparo em 2-3 dias)
      const order = allOrders.find(o => o.orderNumber === orderNumber);
      if (order) void notifyWhatsApp(order, 'paymentConfirmed');
      loadOrders();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível confirmar o pagamento",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (orderNumber: string, newStatus: 'pending' | 'processing' | 'packing' | 'shipped' | 'delivered' | 'cancelled') => {
    const success = await orderService.updateOrderStatus(orderNumber, newStatus);

    if (success) {
      toast({
        title: "Status atualizado!",
        description: `Pedido ${orderNumber} marcado como ${getStatusLabel(newStatus)}`,
      });
      // Notifica o cliente por WhatsApp ao iniciar o preparo do pacote.
      if (newStatus === 'packing') {
        const order = allOrders.find(o => o.orderNumber === orderNumber);
        if (order) void notifyWhatsApp(order, 'preparing');
      }
      loadOrders();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  // Envia notificação WhatsApp ao cliente (silencioso; mostra toast com o resultado).
  const notifyWhatsApp = async (
    order: Order,
    type: 'paymentConfirmed' | 'preparing' | 'shipped',
    extra?: { trackingNumber: string; trackingUrl: string; carrier: string }
  ) => {
    if (!waServer.getConfig().enabled) return;
    const result =
      type === 'paymentConfirmed' ? await waServer.notifyPaymentConfirmed(order)
      : type === 'preparing' ? await waServer.notifyPreparing(order)
      : await waServer.notifyShipped(order, extra!.trackingNumber, extra!.trackingUrl, extra!.carrier);
    if (result.ok) {
      toast({ title: '📱 WhatsApp enviado!', description: `Cliente notificado (${type}).` });
    } else {
      toast({ title: '⚠️ WhatsApp não enviado', description: result.error || 'Erro desconhecido', variant: 'destructive' });
    }
  };

  const handleDeleteOrder = async (orderNumber: string) => {
    const done = await confirm({
      title: `Excluir o pedido ${orderNumber}?`,
      details: [
        'O pedido é apagado do sistema: some de Pedidos, do financeiro e do perfil do cliente.',
        'Para só interromper a venda, use "Cancelar" (o pedido fica no histórico).',
      ],
      destructive: true,
      password: true,
      permission: 'delete',
      onConfirm: async () => {
        if (!(await orderService.deleteOrder(orderNumber))) throw new Error('Não foi possível excluir o pedido.');
      },
    });
    if (!done) return;
    toast({ title: 'Pedido excluído', description: `Pedido ${orderNumber} foi removido` });
    loadOrders();
  };

  const handleCancelOrder = async (orderNumber: string) => {
    const done = await confirm({
      title: `Cancelar o pedido ${orderNumber}?`,
      details: [
        'O cliente passa a ver o pedido como cancelado.',
        'O pedido continua no histórico, fora do faturamento.',
      ],
      destructive: true,
      confirmLabel: 'Cancelar pedido',
      onConfirm: async () => {
        if (!(await orderService.updateOrderStatus(orderNumber, 'cancelled'))) throw new Error('Não foi possível cancelar o pedido.');
      },
    });
    if (!done) return;
    toast({ title: 'Pedido cancelado', description: `Pedido ${orderNumber} marcado como ${getStatusLabel('cancelled')}` });
    loadOrders();
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Aguardando Pagamento',
      processing: 'Pago / Preparando',
      packing: 'Preparando Pacote',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      packing: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Test notification services
  const testNotifications = async () => {
    setIsTesting(true);
    devLog('🧪 Starting notification tests...');
    
    try {
      // Test Email
      devLog('📧 Testing email service...');
      
      let emailResult = false;
      let whatsappResult = false;
      
      // Resend via /api/send-email (servidor). A chave fica só na Vercel.
      devLog('📧 Testing Resend...');
      const testEmailHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1 style="color: #22c55e;">🧪 Test Email (Resend)</h1>
              <p>This is a test email from Japan Express!</p>
              <p>If you received this, your email configuration is working correctly! ✅</p>
              <p>Time: ${new Date().toLocaleString('pt-BR')}</p>
            </body>
          </html>
        `;

      emailResult = await emailService.sendOrderConfirmation({
        to: ADMIN_EMAIL,
        subject: '🧪 Test Email (Resend) - Japan Express',
        html: testEmailHTML,
        orderNumber: 'TEST-' + Date.now(),
        customerName: 'Test User'
      });
      
      devLog('📧 Email test result:', emailResult);
      
      // Wait a bit before WhatsApp test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test WhatsApp
      devLog('📱 Testing WhatsApp service...');
      const testMessage = `
🧪 *Test Message*

This is a test message from Japan Express!

If you received this, your WhatsApp configuration is working correctly! ✅

Time: ${new Date().toLocaleString('pt-BR')}

_This is an automated test message_
      `.trim();
      
      // Provider credentials are server-only. The browser test only opens the
      // safe manual client; automatic delivery is exercised through the
      // authenticated server service in the WhatsApp settings panel.
      devLog('📱 Testing Simple WhatsApp (opens directly)...');
      whatsappServiceSimple.sendMessage({
        to: COMPANY_PROFILE.whatsapp.digits,
        message: testMessage
      });
      whatsappResult = true; // It opened, so consider it a success
      
      devLog('📱 WhatsApp test result:', whatsappResult);
      
      toast({
        title: "🧪 Testes Concluídos!",
        description: `Email: ${emailResult ? '✅ Enviado' : '⚠️ Abriu cliente'} | WhatsApp: ${whatsappResult ? '✅ Abriu' : '⚠️ Verifique'}`,
      });
      
    } catch (error) {
      devError('❌ Test error:', error);
      toast({
        title: "❌ Erro nos Testes",
        description: "Verifique o console (F12) para mais detalhes",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Abas agrupadas (menu lateral) — orientado a dados
  const tabGroups: { title: string; items: AdminTabItem[] }[] = [
    { title: 'Visão geral', items: [{ id: 'dashboard', label: 'Dashboard', icon: BarChart3 }] },
    { title: 'Vendas', items: [
      { id: 'orders', label: 'Pedidos', icon: Package, badge: ordersHasMore ? undefined : pendingOrdersCount },
      { id: 'affiliates', label: 'Afiliados', icon: Megaphone, badge: Math.max(affiliatePendingCount, pendingAffiliateRequestsCount, pendingReviewsCount) },
      { id: 'sandbox', label: 'Sandbox', icon: TestTube },
      { id: 'negotiations', label: 'Negociações', icon: Handshake, badge: pendingNegotiationsCount || 0 },
      { id: 'customers', label: 'Clientes', icon: Users, badge: Math.max(newCustomers, pendingAffiliateRequestsCount) },
      { id: 'visitors', label: 'Visitantes', icon: BarChart3 },
    ] },
    { title: 'Catálogo', items: [
      { id: 'products', label: 'Produtos', icon: PackagePlus },
      { id: 'coupons', label: 'Cupons', icon: Tag },
      { id: 'review-moderation', label: 'Moderação Reviews', icon: Flag },
    ] },
    { title: 'Solicitações', items: [
      { id: 'requests', label: 'Personalizados', icon: Sparkles, badge: newRequests },
      { id: 'b2b', label: 'Empresas', icon: Building2 },
      { id: 'videos', label: 'Vídeos de review', icon: Video },
    ] },
    { title: 'Conteúdo', items: [
      { id: 'home', label: 'Início', icon: Video },
      { id: 'vlog', label: 'Vlog', icon: Clapperboard },
      { id: 'sorteio', label: 'Sorteio', icon: Trophy },
    ] },
    { title: 'Financeiro', items: [
      { id: 'marketing', label: 'Gastos Marketing', icon: Megaphone },
      { id: 'employees', label: 'Funcionários', icon: Users },
      { id: 'coupon-usage', label: 'Gastos c/ Cupons', icon: Tag },
      { id: 'fraud', label: 'Anti-Fraude', icon: ShieldCheck },
      { id: 'margin-audit', label: 'Auditoria de Margem', icon: TrendingDown },
      { id: 'finance-detail', label: 'Impostos & Importação', icon: Landmark },
    ] },
    { title: 'Ferramentas', items: [
      { id: 'promotion', label: 'Promoção Início', icon: Sparkles },
      { id: 'calculator', label: 'Calculadora', icon: Calculator },
      { id: 'migration', label: 'Migrar Imagens', icon: CloudUpload },
      { id: 'thermal-printer', label: 'Impressora Térmica', icon: Printer },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ] },
    // Só nível 3 vê o gerenciamento de administradores
    ...(permissions.canManageAdmins
      ? [{ title: 'Configurações', items: [{ id: 'admins' as AdminTab, label: 'Administradores', icon: ShieldCheck }] }]
      : []),
  ];
  const allTabs: AdminTabItem[] = tabGroups.flatMap((g) => g.items);
  const activeLabel = allTabs.find((t) => t.id === activeTab)?.label || '';

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              🔐 Painel Administrativo
            </h1>
            <p className="text-muted-foreground text-lg">
              Gestão de Pedidos - Paula Shiokawa
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="gap-2 border-orange-400 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => setPromoModalOpen(true)}
              >
                <Megaphone className="w-4 h-4" />
                Disparar Notificação Promocional
              </Button>
              <Button
                variant="outline"
                className={`gap-2 ${settings.vlogEnabled ? 'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950' : 'border-border text-muted-foreground hover:bg-secondary'}`}
                onClick={() => saveSettings({ ...settings, vlogEnabled: !settings.vlogEnabled })}
              >
                {settings.vlogEnabled ? '👁 Vlog ATIVO' : '🙈 Vlog OCULTO'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {noAdminSession && (
        <div className="container mx-auto px-4 pt-6">
          <div className="max-w-7xl mx-auto rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive">
              Sua sessão de admin não está ativa. Pedidos, clientes e dashboard só carregam depois de entrar novamente.
            </p>
            <Button variant="destructive" size="sm" onClick={() => navigate('/login')}>
              Entrar novamente
            </Button>
          </div>
        </div>
      )}

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto lg:flex lg:gap-8 lg:items-start">

            <AdminSidebar
              tabGroups={tabGroups}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            {/* COLUNA DE CONTEÚDO */}
            <div className="flex-1 min-w-0">
              <AdminMobileNav
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                tabGroups={tabGroups}
                activeLabel={activeLabel}
              />

            {/* Content */}
            <Suspense fallback={<TabLoading />}>
            {activeTab === 'orders' ? (
              <>
            
            <AdminNotificationTest
              testNotifications={testNotifications}
              isTesting={isTesting}
            />
            
            <AdminOrderStats
              allOrders={allOrders}
              pendingOrdersCount={pendingOrdersCount}
            />

            <AdminOrdersList
              ordersLoading={ordersLoading}
              allOrders={allOrders}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              setCn23Order={setCn23Order}
              handleConfirmPayment={handleConfirmPayment}
              handleUpdateStatus={handleUpdateStatus}
              setSelectedOrder={setSelectedOrder}
              setTrackingModalOpen={setTrackingModalOpen}
              handleCancelOrder={handleCancelOrder}
              handleDeleteOrder={handleDeleteOrder}
              ordersHasMore={ordersHasMore}
              loadOrders={loadOrders}
              ordersLoadingMore={ordersLoadingMore}
            />
            </>
            ) : activeTab === 'coupons' ? (
              <CouponManager />
            ) : activeTab === 'dashboard' ? (
              <Dashboard
                pending={{
                  negotiations: pendingNegotiationsCount,
                  affiliates: Math.max(affiliatePendingCount, pendingAffiliateRequestsCount, pendingReviewsCount),
                  requests: newRequests,
                }}
                onNavigate={setActiveTab}
              />
            ) : activeTab === 'products' ? (
              <ProductManager />
            ) : activeTab === 'home' ? (
              <HomeContentManager />
            ) : activeTab === 'vlog' ? (
              <VlogManager />
            ) : activeTab === 'sorteio' ? (
              <SorteioManager />
            ) : activeTab === 'affiliates' ? (
              <AffiliateManager />
            ) : activeTab === 'requests' ? (
              <CustomRequestManager />
            ) : activeTab === 'b2b' ? (
              <B2BRequestManager />
            ) : activeTab === 'videos' ? (
              <VideoReviewManager />
            ) : activeTab === 'admins' ? (
              <AdminAccessManager />
            ) : activeTab === 'promotion' ? (
              <PromotionManager />
            ) : activeTab === 'calculator' ? (
              <AdminCalculator />
            ) : activeTab === 'migration' ? (
              <ImageMigration />
            ) : activeTab === 'negotiations' ? (
              <NegotiationManager />
            ) : activeTab === 'marketing' ? (
              <MarketingManager />
            ) : activeTab === 'employees' ? (
              <EmployeeManager />
            ) : activeTab === 'coupon-usage' ? (
              <CouponUsageReport />
            ) : activeTab === 'fraud' ? (
              <FraudDashboard />
            ) : activeTab === 'thermal-printer' ? (
              <ThermalPrinterSettings />
            ) : activeTab === 'whatsapp' ? (
              <WhatsAppSettings />
            ) : activeTab === 'visitors' ? (
              <VisitorStats />
            ) : activeTab === 'review-moderation' ? (
              <ReviewModeration />
            ) : activeTab === 'margin-audit' ? (
              <MarginAudit />
            ) : activeTab === 'finance-detail' ? (
              <FinanceDetailManager />
            ) : activeTab === 'sandbox' ? (
              <CheckoutSandbox />
            ) : (
              <CustomerList />
            )}
            </Suspense>
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
      {/* Promo Notification Modal */}
      {promoModalOpen && (
        <PromoNotificationModal onClose={() => setPromoModalOpen(false)} />
      )}

      {/* CN22/CN23 Modal */}
      {cn23Order && (
        <CN23Modal order={cn23Order} onClose={() => setCn23Order(null)} />
      )}

      {/* Tracking Modal */}
      {selectedOrder && (
        <TrackingModal
          order={selectedOrder}
          isOpen={trackingModalOpen}
          onClose={() => {
            setTrackingModalOpen(false);
            setSelectedOrder(null);
          }}
          onSuccess={async (trackingNumber, carrierFromModal) => {
            // Get carrier info from modal (which reads from order.shipping.carrier) or fallback
            const carrier = carrierFromModal || selectedOrder.shipping?.carrier || selectedOrder.carrier || '';
            const trackingUrl = trackingUrlFor(carrier, trackingNumber);

            // Save tracking info to order (Firestore + safeStorage)
            await orderService.updateOrderTracking(selectedOrder.orderNumber, trackingNumber, trackingUrl, carrier);

            // Update status to shipped (sem disparar o WhatsApp de 'packing' aqui)
            await orderService.updateOrderStatus(selectedOrder.orderNumber, 'shipped');
            loadOrders();
            toast({
              title: "Pedido marcado como enviado!",
              description: `Tracking: ${trackingNumber}`,
            });
            // Notifica o cliente com itens + código de rastreio
            void notifyWhatsApp(selectedOrder, 'shipped', { trackingNumber, trackingUrl, carrier });
          }}
        />
      )}
      </Suspense>
    </Layout>
  );
};

export default Admin;
