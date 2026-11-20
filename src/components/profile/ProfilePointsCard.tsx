import React from 'react';
import { TIERS, tierProgress } from '@/services/pointsService';
import { Trophy } from 'lucide-react';
import { TIER_TROPHY } from '@/components/profile/tierTrophy';
import ReferralCard from '@/components/profile/ReferralCard';
import { UserProfile } from '@/context/UserContext';

interface ProfilePointsCardProps {
  t: (key: string) => string;
  user: UserProfile;
  tierInfo: ReturnType<typeof tierProgress>;
}

const ProfilePointsCard: React.FC<ProfilePointsCardProps> = ({
  t,
  user,
  tierInfo,
}) => {
  return (
    <>

    {/* Pontos de Fidelidade */}
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.points.title')}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
        {user?.points || 0} <span className="text-base font-medium text-muted-foreground">pts</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t('profile.points.desc')}</p>

      {/* Níveis de pontos. Mostra ONDE o cliente está e QUANTO falta —
          a lista de faixas sozinha é abstrata e não responde "e eu?".
          Fica no cartão dos pontos porque é a resposta para "como eu
          ganho mais?". */}
      <div className="mt-5 border-t border-border pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.points.tiers.title')}</p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {TIERS.map((nivel) => {
            const atual = nivel.id === tierInfo.tier.id;
            const alcancado = tierInfo.spendYen >= nivel.minSpendYen;
            return (
              <div
                key={nivel.id}
                className={`rounded-lg border px-2 py-3 text-center ${atual ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <Trophy
                  className={`mx-auto h-6 w-6 ${TIER_TROPHY[nivel.id]} ${alcancado ? '' : 'opacity-40'}`}
                  strokeWidth={2.5}
                />
                <p className="mt-1.5 text-xs font-semibold capitalize text-foreground">{t(`profile.points.tiers.name.${nivel.id}`)}</p>
                <p className="text-[11px] text-muted-foreground">{nivel.multiplier}x</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {nivel.minSpendYen === 0
                    ? t('profile.points.tiers.start')
                    : `${t('profile.points.tiers.goal')} ¥${nivel.minSpendYen.toLocaleString('pt-BR')}`}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>
              {t('profile.points.tiers.spent')} <strong className="text-sm text-foreground">¥{tierInfo.spendYen.toLocaleString('pt-BR')}</strong>
            </span>
            {tierInfo.next && (
              <span>¥{tierInfo.next.minSpendYen.toLocaleString('pt-BR')}</span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${tierInfo.percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-foreground">
            {tierInfo.next ? (
              <>
                {t('profile.points.tiers.missing')}{' '}
                <strong>¥{tierInfo.remainingYen.toLocaleString('pt-BR')}</strong>{' '}
                {t('profile.points.tiers.toReach')}{' '}
                <strong className="capitalize">{t(`profile.points.tiers.name.${tierInfo.next.id}`)}</strong>{' '}
                ({tierInfo.next.multiplier}x)
              </>
            ) : (
              t('profile.points.tiers.max')
            )}
          </p>
        </div>

        <p className="mt-3 text-[11px] italic text-muted-foreground">{t('profile.points.tiers.window')}</p>
      </div>
    </div>

    <ReferralCard />

    </>
  );
};

export default ProfilePointsCard;
