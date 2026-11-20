import type { SocialProvider } from '@/services/firebaseSyncService';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // apenas em memória para modo local-only; NUNCA persistir
  birthdate?: string;
  adminRole?: number;         // nível de admin (1/2/3) quando é sessão de admin
  personType?: 'PF' | 'PJ';   // Pessoa Física ou Jurídica
  cpf?: string;               // CPF (PF, Brasil) — obrigatório p/ Remessa Conforme
  cnpj?: string;              // CNPJ (PJ, Brasil)
  razaoSocial?: string;       // se PJ
  document?: string;          // Documento de identificação para envio internacional (passaporte, NIF, etc.)
  gender?: 'masculino' | 'feminino' | 'outro';
  whatsappMarketing?: boolean;
  pushEnabled?: boolean;      // notificações push (Web Push/VAPID) ativas neste navegador
  points?: number; // Pontos de fidelidade (reviews, vídeos)
  birthdayBonusYear?: number; // Ano em que já recebeu os 1000 pts de aniversário
  address: {
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
  };
  createdAt: string;
  coupons?: Coupon[]; // Cupons do perfil (sincronizados no Firestore)
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  expiresAt: string;
  isUsed: boolean;
  freeShipping?: boolean;
  affiliateCode?: string;     // se preenchido, é um código de influencer (gera comissão)
  affiliateProductId?: string; // se preenchido, cupom vinculado a produto específico (permite reuso por CPF)
  affiliateSource?: 'link' | 'code';
  minOrderValue?: number;     // valor mínimo do pedido em ¥ para usar o cupom
}

// Fábrica do cupom de boas-vindas concedido no cadastro.
export const makeWelcomeCoupon = (): Coupon => ({
  id: `welcome-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  code: 'BEMVINDO10',
  description: 'Cupom de boas-vindas — 10% de desconto',
  discount: 10,
  discountType: 'percentage',
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  isUsed: false,
});

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  /** ISO gravado pelo servidor (`api/orders.js`). `date` é a versão pt-BR, só
   *  para exibição — para comparar datas use este. */
  orderDate?: string;
  /** Só vira `true` quando o pagamento é confirmado
   *  (`api/_lib/fulfillment.js`): separa pedido pago de pedido só criado. */
  paymentConfirmed?: boolean;
  items: Array<{
    productName: string;
    size: string;
    quantity: number;
    /** Preço unitário na moeda exibida ao cliente (BRL, USD...). */
    price: number;
    /** Preço unitário em ienes. É o único valor comparável entre pedidos de
     *  países diferentes — o que o cálculo de nível de pontos precisa. */
    unitYen?: number;
    /** Brinde de promoção: não é mercadoria paga, fica fora dos pontos. */
    freeGift?: boolean;
  }>;
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shipping?: {
    carrier: string;
    cost: number;
    estimatedDays?: string;
  };
  shippingAddress: {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address: string;
    building?: string;
  };
}

export interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  authReady: boolean;        // true após o primeiro disparo do onAuthChange (sem flash de login)
  isAdmin: boolean;          // agindo como admin (conta admin E modo != cliente)
  isAdminAccount: boolean;   // a conta É admin (independente do modo escolhido)
  adminRole: number;         // 0=não admin, 1/2/3
  permissions: { canDelete: boolean; canFinancial: boolean; canManageAdmins: boolean };
  loginAs: 'admin' | 'user' | null;
  setLoginAs: (mode: 'admin' | 'user') => void;
  coupons: Coupon[];
  orders: Order[];
  ordersHasMore: boolean;
  ordersLoadingMore: boolean;
  loadMoreOrders: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; code?: string; needsVerification?: boolean }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithProvider: (provider: SocialProvider) => Promise<{ success: boolean; error?: string }>;
  sendPhoneCode: (phoneE164: string, verifier: RecaptchaVerifier) => Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }>;
  confirmPhoneCode: (confirmationResult: ConfirmationResult, code: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<{ success: boolean; error?: string; verificationEmailSent?: boolean }>;
  logout: () => void;
  updateProfile: (userData: Partial<UserProfile>) => void;
  addPoints: (amount: number) => void;
  addCoupon: (coupon: Coupon) => void;
  useCoupon: (couponId: string) => void;
  consumeCouponByCode: (code: string) => void;
  validateProfileCoupon: (code: string, orderTotalYen?: number) => { valid: boolean; coupon?: Coupon; error?: string };
  addOrder: (order: Omit<Order, 'id' | 'date'> & { orderNumber?: string }) => Promise<void> | void;
  clearOrderHistory: () => void;
  refreshOrders: () => Promise<void>;
  /** `true` quando a leitura dos pedidos no servidor falhou e o que está na
   *  tela é só a cópia local — que some se o cliente limpar o navegador ou
   *  entrar de outro aparelho. Precisa ser visível: um histórico faltando em
   *  silêncio parece pedido perdido. */
  ordersOffline: boolean;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<boolean>;
}
