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
    <div className="bg-gradient-to-r from-amber-400 to-pink-500 rounded-2xl p-6 lg:p-8 text-white shadow-elevated">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/90">{t('profile.points.title')}</p>
          <p className="font-display text-5xl font-extrabold mt-1">{user?.points || 0} <span className="text-2xl font-bold">pts</span></p>
          <p className="text-sm text-white/90 mt-1">{t('profile.points.desc')}</p>
        </div>
        <div className="text-7xl opacity-80">🎁</div>
      </div>
      {/* Níveis de pontos. Mostra ONDE o cliente está e QUANTO falta —
          a lista de faixas sozinha é abstrata e não responde "e eu?".
          Fica no cartão dos pontos porque é a resposta para "como eu
          ganho mais?". */}
      <div className="mt-6 pt-6 border-t border-white/20">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/90 mb-4">{t('profile.points.tiers.title')}</p>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {TIERS.map((nivel) => {
            const atual = nivel.id === tierInfo.tier.id;
            const alcancado = tierInfo.spendYen >= nivel.minSpendYen;
            return (
              <div
                key={nivel.id}
                className={`rounded-xl px-2 py-3 text-center transition ${
                  atual ? 'bg-white/25 ring-2 ring-white/80 shadow-lg' : 'bg-white/10'
                }`}
              >
                <Trophy
                  className={`w-7 h-7 mx-auto ${TIER_TROPHY[nivel.id]} ${alcancado ? '' : 'opacity-40'}`}
                  strokeWidth={2.5}
                />
                <p className="text-xs font-bold mt-1.5 capitalize">{t(`profile.points.tiers.name.${nivel.id}`)}</p>
                <p className="text-[11px] text-white/80">{nivel.multiplier}x</p>
                <p className="text-[10px] text-white/70 mt-0.5">
                  {nivel.minSpendYen === 0
                    ? t('profile.points.tiers.start')
                    : `${t('profile.points.tiers.goal')} ¥${nivel.minSpendYen.toLocaleString('pt-BR')}`}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-white/90 mb-1.5">
            <span>
              {t('profile.points.tiers.spent')} <strong className="text-sm">¥{tierInfo.spendYen.toLocaleString('pt-BR')}</strong>
            </span>
            {tierInfo.next && (
              <span className="text-white/80">¥{tierInfo.next.minSpendYen.toLocaleString('pt-BR')}</span>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition duration-500"
              style={{ width: `${tierInfo.percent}%` }}
            />
          </div>
          <p className="text-xs text-white/95 mt-2 font-medium">
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

        <p className="text-[11px] italic text-white/70 mt-3">{t('profile.points.tiers.window')}</p>
      </div>
    </div>

    <ReferralCard />

    </>
  );
};

export default ProfilePointsCard;
