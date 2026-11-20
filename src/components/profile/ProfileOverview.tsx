import React from 'react';
import type { ProfileSection } from '@/components/profile/profileSections';

interface ProfileOverviewProps {
  t: (key: string) => string;
  points: number;
  ordersCount: number;
  activeCoupons: number;
  tierName: string;
  onSelect: (section: ProfileSection) => void;
}

/** Visão geral: três números e o nível. Cada número leva à seção dele. */
const ProfileOverview: React.FC<ProfileOverviewProps> = ({ t, points, ordersCount, activeCoupons, tierName, onSelect }) => {
  const stats: { id: ProfileSection; label: string; value: number }[] = [
    { id: 'recompensas', label: t('profile.overview.points'), value: points },
    { id: 'pedidos', label: t('profile.overview.orders'), value: ordersCount },
    { id: 'cupons', label: t('profile.overview.coupons'), value: activeCoupons },
  ];
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="grid grid-cols-3 divide-x divide-border">
        {stats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => onSelect(stat.id)}
            className="min-h-[44px] px-4 py-5 text-left transition-colors first:rounded-l-xl last:rounded-r-xl hover:bg-secondary/40"
          >
            <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </button>
        ))}
      </div>
      <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
        {t('profile.overview.level')}: <span className="font-medium capitalize text-foreground">{tierName}</span>
      </p>
    </section>
  );
};

export default ProfileOverview;
