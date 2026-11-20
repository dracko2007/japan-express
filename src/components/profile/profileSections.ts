import { Bell, Gift, Handshake, LayoutDashboard, Megaphone, ShoppingBag, Trophy, User, type LucideIcon } from 'lucide-react';

/** Seções da área da conta. O id vai na URL (`/perfil?aba=pedidos`), então não muda sem motivo. */
export type ProfileSection = 'visao-geral' | 'dados' | 'notificacoes' | 'pedidos' | 'cupons' | 'negociacoes' | 'recompensas' | 'afiliado';

export interface ProfileNavItem {
  id: ProfileSection;
  labelKey: string;
  icon: LucideIcon;
}

export interface ProfileNavGroup {
  titleKey: string;
  items: ProfileNavItem[];
}

export const PROFILE_NAV: ProfileNavGroup[] = [
  {
    titleKey: 'profile.nav.group.account',
    items: [
      { id: 'visao-geral', labelKey: 'profile.nav.overview', icon: LayoutDashboard },
      { id: 'dados', labelKey: 'profile.nav.info', icon: User },
      { id: 'notificacoes', labelKey: 'profile.nav.notifications', icon: Bell },
    ],
  },
  {
    titleKey: 'profile.nav.group.shopping',
    items: [
      { id: 'pedidos', labelKey: 'profile.nav.orders', icon: ShoppingBag },
      { id: 'cupons', labelKey: 'profile.nav.coupons', icon: Gift },
      { id: 'negociacoes', labelKey: 'profile.nav.negotiations', icon: Handshake },
    ],
  },
  {
    titleKey: 'profile.nav.group.programs',
    items: [
      { id: 'recompensas', labelKey: 'profile.nav.rewards', icon: Trophy },
      { id: 'afiliado', labelKey: 'profile.nav.affiliate', icon: Megaphone },
    ],
  },
];

export const DEFAULT_SECTION: ProfileSection = 'visao-geral';

const ALL = PROFILE_NAV.flatMap((group) => group.items.map((item) => item.id));

/** Valor da URL → seção. Qualquer coisa desconhecida cai na visão geral. */
export const parseSection = (value: string | null): ProfileSection =>
  (ALL as string[]).includes(value ?? '') ? (value as ProfileSection) : DEFAULT_SECTION;
