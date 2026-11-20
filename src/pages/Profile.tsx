import { safeStorage } from '@/utils/storage';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { negotiationService } from '@/services/negotiationService';
import type { Negotiation } from '@/types/negotiation';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useUser, UserProfile } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { prefectures } from '@/data/prefectures';
import { japanPrefectures } from '@/data/japanPrefectures';
import { useLanguage } from '@/context/LanguageContext';
import { addAddressHints } from '@/utils/romanize';
import { useProducts } from '@/context/ProductsContext';
import { isValidEmail, isValidPhone, isNonEmpty, maskPhone, isValidCPF, isValidCNPJ, maskCPF, maskCNPJ } from '@/utils/validation';
import { affiliateService, AffiliateRequest } from '@/services/affiliateService';
import { orderService } from '@/services/orderService';
import ReviewModal from '@/components/products/ReviewModal';
import SocialFollowRewards from '@/components/profile/SocialFollowRewards';
import PromoNotificationsCard from '@/components/profile/PromoNotificationsCard';
import { pushService } from '@/services/pushService';
import { getEmailSubscription, setEmailSubscription } from '@/services/mailService';
import { tierProgress } from '@/services/pointsService';
import { recentProductSpendYen } from '@/utils/loyaltySpend';
import ProfileNegotiations from '@/components/profile/ProfileNegotiations';
import ProfilePointsCard from '@/components/profile/ProfilePointsCard';
import ProfileOrderHistory from '@/components/profile/ProfileOrderHistory';
import ProfileCoupons from '@/components/profile/ProfileCoupons';
import ProfileAffiliatePanel from '@/components/profile/ProfileAffiliatePanel';
import ProfilePersonalInfo from '@/components/profile/ProfilePersonalInfo';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

const Profile: React.FC = () => {
  const {
    user,
    isAuthenticated,
    authReady,
    coupons,
    orders,
    ordersHasMore,
    ordersLoadingMore,
    loadMoreOrders,
    updateProfile,
    logout,
    refreshOrders,
    ordersOffline,
  } = useUser();
  const { t, selectedCountry } = useLanguage();
  const { products } = useProducts();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<UserProfile>>(user || {});

  // Nível de pontos: mesmo gasto e mesmas faixas que a revisão do pedido usa
  // para prometer os pontos, então as duas telas nunca discordam.
  const tierInfo = useMemo(() => tierProgress(recentProductSpendYen(orders)), [orders]);

  // Notificações push (Web Push/VAPID) — estado real da inscrição neste navegador,
  // checado no navegador (não só a flag `pushEnabled` do perfil, que pode ficar
  // desatualizada se o cliente trocar de dispositivo ou limpar os dados do site).
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    pushService.isSubscribed().then(setPushSubscribed);
  }, []);

  const togglePush = async () => {
    if (!user) return;
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        const res = await pushService.unsubscribe();
        if (res.ok) {
          setPushSubscribed(false);
          updateProfile({ pushEnabled: false });
          toast({ title: 'Notificações desativadas', description: 'Você não vai mais receber push neste dispositivo.' });
        } else {
          toast({ title: 'Erro ao desativar', description: res.error, variant: 'destructive' });
        }
      } else {
        const res = await pushService.subscribe({ email: user.email, name: user.name });
        if (res.ok) {
          setPushSubscribed(true);
          updateProfile({ pushEnabled: true });
          toast({ title: '🔔 Notificações ativadas!', description: 'Você vai receber promoções e novidades por push.' });
        } else {
          toast({ title: 'Não foi possível ativar', description: res.error, variant: 'destructive' });
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  // Inscrição de e-mail. O estado verdadeiro é o do servidor (`email_optout`),
  // o mesmo registro que o link "Cancelar inscrição" do rodapé grava — quem
  // cancelou por lá precisa ver "desativado" aqui, e não uma flag do perfil que
  // ninguém consulta na hora de enviar.
  const [emailNews, setEmailNews] = useState(true);
  const [emailNewsBusy, setEmailNewsBusy] = useState(true);
  useEffect(() => {
    if (!isAuthenticated) return;
    getEmailSubscription().then((r) => {
      setEmailNews(r.subscribed);
      setEmailNewsBusy(false);
    });
  }, [isAuthenticated]);

  const toggleEmailNews = async () => {
    const novo = !emailNews;
    setEmailNewsBusy(true);
    const r = await setEmailSubscription(novo);
    setEmailNews(r.subscribed);
    setEmailNewsBusy(false);
    if (!r.ok) {
      toast({ title: 'Não foi possível salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: novo ? '✅ Inscrição ativada' : 'Inscrição cancelada',
      description: novo
        ? 'Você vai receber novidades e promoções por e-mail.'
        : 'Você não vai mais receber e-mail de divulgação. Confirmação de pedido e rastreio continuam chegando.',
    });
  };

  // País do ENDEREÇO (independente do idioma do site). Define qual busca de CEP
  // e qual lista de estados/províncias usar.
  const addressCountry = (editedUser.address as any)?.country || selectedCountry || 'Brasil';
  const EUROPE = ['Portugal', 'França', 'Itália', 'Espanha', 'Alemanha'];
  const isJapanAddress = addressCountry === 'Japão';
  const isBrazilAddress = addressCountry === 'Brasil';
  const isEuropeAddress = EUROPE.includes(addressCountry);
  // Lista de estados/províncias (Japão/Brasil têm lista; Europa é texto livre).
  const addressList = isJapanAddress ? japanPrefectures : prefectures;

  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const handleConfirmReceived = async (orderNumber: string) => {
    if (!user) return;
    setConfirmingOrderId(orderNumber);
    try {
      const confirmed = await orderService.updateOrderStatus(
        orderNumber,
        'delivered',
        { customerConfirmation: true }
      );
      if (!confirmed) throw new Error('Não foi possível confirmar o recebimento.');

      const now = new Date().toISOString();

      const ordersKey = `orders_${user.id}`;
      const rawOrders = JSON.parse(safeStorage.getItem(ordersKey) || '[]');
      const updatedOrders = rawOrders.map((o) =>
        o.orderNumber === orderNumber ? { ...o, status: 'delivered', updatedAt: now } : o
      );
      safeStorage.setItem(ordersKey, JSON.stringify(updatedOrders));

      const users = JSON.parse(safeStorage.getItem('japan-express-users') || '{}');
      Object.keys(users).forEach((email) => {
        (users[email].orders || []).forEach((o, i: number) => {
          if (o.orderNumber === orderNumber) {
            users[email].orders[i].status = 'delivered';
            users[email].orders[i].updatedAt = now;
          }
        });
      });
      safeStorage.setItem('japan-express-users', JSON.stringify(users));

      const sakura = JSON.parse(safeStorage.getItem('sakura_orders') || '[]');
      const updatedSakura = sakura.map((o) =>
        o.orderNumber === orderNumber ? { ...o, status: 'delivered', updatedAt: now } : o
      );
      safeStorage.setItem('sakura_orders', JSON.stringify(updatedSakura));

      refreshOrders();
      toast({ title: '✅ Recebimento confirmado!', description: 'Obrigado por confirmar. Que aproveite!' });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Tente novamente.';
      toast({ title: 'Erro ao confirmar', description, variant: 'destructive' });
    } finally {
      setConfirmingOrderId(null);
    }
  };

  // Avaliação a partir do histórico de pedidos
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string } | null>(null);
  const [reviewBump, setReviewBump] = useState(0); // força recálculo de "já avaliou"
  // O id gravado no pedido é o que o servidor confere ao salvar a avaliação;
  // o nome só vale para pedido antigo, sem id (ou produto renomeado depois).
  const findProductId = (item: { productId?: string; productName: string }) => {
    const id = String(item.productId || '');
    if (id && products.some((p) => p.id === id)) return id;
    return products.find((p) => p.name === item.productName)?.id;
  };

  // Mostra o atalho do painel de afiliado só se a conta for de um influencer
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affRequest, setAffRequest] = useState<AffiliateRequest | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Negociações do usuário
  // Refresh orders from localStorage on mount so tracking updates from admin are visible
  useEffect(() => { void refreshOrders(); }, []);

  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  useEffect(() => {
    if (!user?.id && !user?.email) return;
    return negotiationService.listenByUser(user.id || user.email || '', setNegotiations);
  }, [user?.id, user?.email]);
  useEffect(() => {
    if (user?.email) {
      affiliateService.getByOwnerEmail(user.email).then((list) => setIsAffiliate(list.length > 0));
      affiliateService.getMyRequest(user.email).then(setAffRequest);
    }
  }, [user?.email]);

  const handleBecomeAffiliate = async () => {
    if (!user?.email) return;
    setRequesting(true);
    const res = await affiliateService.requestAffiliate(user.name || '', user.email);
    setRequesting(false);
    if (res.ok) {
      toast({ title: '✅ Solicitação enviada!', description: 'Nossa equipe vai analisar e te avisar. Obrigado pelo interesse! 🎉' });
      setAffRequest({ email: user.email.toLowerCase(), name: user.name || '', status: 'pending', requestedAt: new Date().toISOString() });
    } else {
      toast({ title: 'Não foi possível enviar', description: res.error, variant: 'destructive' });
    }
  };

  // Função para recomprar um pedido
  const handleReorder = (order: any) => {
    clearCart();
    
    let itemsAdded = 0;
    
    // Adiciona todos os itens do pedido ao carrinho
    order.items.forEach((item: any) => {
      // Busca o produto original pelo nome
      const product = products.find(p => p.name === item.productName);
      
      if (product) {
        addToCart(product, item.size as 'small' | 'large', item.quantity);
        itemsAdded++;
      }
    });
    
    if (itemsAdded > 0) {
      toast({
        title: "Itens adicionados ao carrinho!",
        description: `${itemsAdded} produto(s) do pedido #${order.orderNumber}`,
      });
      
      // Navega para o carrinho
      navigate('/carrinho');
    } else {
      toast({
        title: "Erro ao adicionar itens",
        description: "Alguns produtos podem não estar mais disponíveis",
        variant: "destructive",
      });
    }
  };



  // Redirect if not authenticated (aguarda authReady para evitar flash de login)
  React.useEffect(() => {
    if (authReady && !isAuthenticated) {
      navigate('/cadastro');
    }
  }, [isAuthenticated, authReady, navigate]);

  if (!user) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEditedUser(prev => ({
        ...prev,
        [parent]: {
          ...((prev as UserProfile)[parent as keyof UserProfile] as Record<string, unknown>),
          [child]: value
        }
      }));
    } else {
      let nextValue = value;
      if (name === 'phone') nextValue = maskPhone(value);
      else if (name === 'cpf') nextValue = maskCPF(value);
      else if (name === 'cnpj') nextValue = maskCNPJ(value);
      setEditedUser(prev => ({ ...prev, [name]: nextValue }));
    }
  };

  // Busca automática de endereço por CEP (Japão via zipcloud, Brasil via ViaCEP).
  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');

    if (isJapanAddress) {
      // CEP japonês: 7 dígitos, formato XXX-XXXX
      const clean = value.slice(0, 7);
      const formatted = clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3, 7)}` : clean;
      setEditedUser(prev => ({ ...prev, address: { ...prev.address, postalCode: formatted } }));

      if (clean.length === 7) {
        try {
          const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`);
          const data = await response.json();
          if (data.status === 200 && data.results && data.results.length > 0) {
            const result = data.results[0];
            // Casa com a lista JAPONESA de províncias (ex.: 東京都)
            const prefecture = japanPrefectures.find(p => p.nameJa === result.address1);
            const city = addAddressHints(result.address2);
            const neighborhood = result.address3 ? addAddressHints(result.address3) : '';
            const cityDisplay = neighborhood ? `${city} ${neighborhood}` : city;
            setEditedUser(prev => ({
              ...prev,
              address: { ...prev.address, postalCode: formatted, prefecture: prefecture?.name || '', city: cityDisplay },
            }));
            toast({ title: "Endereço encontrado!", description: "Província e cidade preenchidos automaticamente." });
          }
        } catch (error) {
          devError('Erro ao buscar CEP japonês:', error);
        }
      }
    } else if (isEuropeAddress) {
      // Europa: formato livre, sem busca automática (o cliente digita região e cidade).
      setEditedUser(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }));
    } else {
      // CEP brasileiro: 8 dígitos, formato XXXXX-XXX
      const clean = value.slice(0, 8);
      const formatted = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5, 8)}` : clean;
      setEditedUser(prev => ({ ...prev, address: { ...prev.address, postalCode: formatted } }));

      if (clean.length === 8) {
        try {
          const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
          const data = await response.json();
          if (response.ok && !data.erro) {
            const addr = data.logradouro ? `${data.logradouro}${data.bairro ? `, Bairro: ${data.bairro}` : ''}` : '';
            setEditedUser(prev => ({
              ...prev,
              address: { ...prev.address, postalCode: formatted, prefecture: data.uf || '', city: data.localidade || '', address: addr || prev.address?.address || '' },
            }));
            toast({ title: "CEP encontrado!", description: `${data.localidade} - ${data.uf}` });
          } else {
            toast({ title: "Erro no CEP", description: "Não foi possível localizar este CEP.", variant: "destructive" });
          }
        } catch (error) {
          devError('Erro ao buscar CEP:', error);
        }
      }
    }
  };

  const handleSaveProfile = () => {
    // Valida antes de salvar
    if (editedUser.name !== undefined && !isNonEmpty(editedUser.name, 2)) {
      toast({ title: 'Nome inválido', description: 'Informe seu nome completo.', variant: 'destructive' });
      return;
    }
    if (editedUser.email !== undefined && !isValidEmail(editedUser.email)) {
      toast({ title: 'E-mail inválido', description: 'Verifique o endereço de e-mail.', variant: 'destructive' });
      return;
    }
    if (editedUser.phone !== undefined && editedUser.phone !== '' && !isValidPhone(editedUser.phone)) {
      toast({ title: 'Telefone inválido', description: 'Use 10 a 11 dígitos.', variant: 'destructive' });
      return;
    }
    // Validação de CPF/CNPJ apenas quando endereço é Brasil
    if (isBrazilAddress) {
      const isPJ = editedUser.personType === 'PJ';
      if (isPJ) {
        if (editedUser.cnpj !== undefined && editedUser.cnpj !== '' && !isValidCNPJ(editedUser.cnpj)) {
          toast({ title: 'CNPJ inválido', description: 'Verifique o número digitado.', variant: 'destructive' });
          return;
        }
      } else {
        if (editedUser.cpf !== undefined && editedUser.cpf !== '' && !isValidCPF(editedUser.cpf)) {
          toast({ title: 'CPF inválido', description: 'Verifique o número digitado.', variant: 'destructive' });
          return;
        }
      }
    }

    const turnedOnMarketing = editedUser.whatsappMarketing && !user.whatsappMarketing;
    // Apenas salva a preferência — NÃO envia/abre WhatsApp Web.
    updateProfile(editedUser);
    setIsEditing(false);
    toast({
      title: "Perfil atualizado!",
      description: turnedOnMarketing
        ? "✅ Você foi inscrito para receber novidades e promoções."
        : "Suas informações foram salvas com sucesso.",
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const activeCoupons = coupons.filter(c => !c.isUsed && new Date(c.expiresAt) > new Date());
  const usedCoupons = coupons.filter(c => c.isUsed);
  const expiredCoupons = coupons.filter(c => !c.isUsed && new Date(c.expiresAt) <= new Date());

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {t('profile.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('profile.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-6">
            <ProfilePointsCard
              t={t}
              user={user}
              tierInfo={tierInfo}
            />
            <SocialFollowRewards />

            <ProfilePersonalInfo
              t={t}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              handleSaveProfile={handleSaveProfile}
              editedUser={editedUser}
              handleInputChange={handleInputChange}
              setEditedUser={setEditedUser}
              isBrazilAddress={isBrazilAddress}
              isJapanAddress={isJapanAddress}
              addressCountry={addressCountry}
              isEuropeAddress={isEuropeAddress}
              handlePostalCodeChange={handlePostalCodeChange}
              addressList={addressList}
              user={user}
              emailNews={emailNews}
              toggleEmailNews={toggleEmailNews}
              emailNewsBusy={emailNewsBusy}
              updateProfile={updateProfile}
              toast={toast}
              pushSubscribed={pushSubscribed}
              togglePush={togglePush}
              pushBusy={pushBusy}
            />

            <ProfileAffiliatePanel
              isAffiliate={isAffiliate}
              t={t}
              affRequest={affRequest}
              handleBecomeAffiliate={handleBecomeAffiliate}
              requesting={requesting}
            />

            {/* Notificações & Promoções (campanhas enviadas pelo admin) */}
            <PromoNotificationsCard />

            <ProfileCoupons
              t={t}
              activeCoupons={activeCoupons}
              usedCoupons={usedCoupons}
              expiredCoupons={expiredCoupons}
            />

            <ProfileOrderHistory
              t={t}
              ordersOffline={ordersOffline}
              refreshOrders={refreshOrders}
              orders={orders}
              handleConfirmReceived={handleConfirmReceived}
              confirmingOrderId={confirmingOrderId}
              findProductId={findProductId}
              user={user}
              reviewBump={reviewBump}
              setReviewTarget={setReviewTarget}
              handleReorder={handleReorder}
              ordersHasMore={ordersHasMore}
              loadMoreOrders={loadMoreOrders}
              ordersLoadingMore={ordersLoadingMore}
              navigate={navigate}
            />

            <ProfileNegotiations
              negotiations={negotiations}
              navigate={navigate}
            />

            {/* Logout Button */}
            <div className="flex justify-center pt-6">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('profile.logout')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {reviewTarget && (
        <ReviewModal
          productId={reviewTarget.id}
          productName={reviewTarget.name}
          onClose={() => setReviewTarget(null)}
          onDone={() => setReviewBump((n) => n + 1)}
        />
      )}
    </Layout>
  );
};

export default Profile;
