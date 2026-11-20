import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AffiliateRequest } from '@/services/affiliateService';

interface ProfileAffiliatePanelProps {
  isAffiliate: boolean;
  t: (key: string) => string;
  affRequest: AffiliateRequest;
  handleBecomeAffiliate: () => Promise<void>;
  requesting: boolean;
}

const ProfileAffiliatePanel: React.FC<ProfileAffiliatePanelProps> = ({
  isAffiliate,
  t,
  affRequest,
  handleBecomeAffiliate,
  requesting,
}) => {
  return (
    <>
    {/* Painel de Afiliado (só para influencers) */}
    {isAffiliate && (
      <Link
        to="/afiliado"
        className="block bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{t('profile.affiliate.panel')}</h2>
              <p className="text-sm text-muted-foreground">{t('profile.affiliate.panel.desc')}</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
        </div>
      </Link>
    )}

    {/* Tornar afiliado (quando ainda não é) */}
    {!isAffiliate && (
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/30 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{t('profile.affiliate.become')}</h2>
            <p className="text-sm text-muted-foreground">{t('profile.affiliate.become.desc')}</p>
          </div>
        </div>
        {affRequest?.status === 'pending' ? (
          <p className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('profile.affiliate.pending')}
          </p>
        ) : affRequest?.status === 'rejected' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('profile.affiliate.rejected')}</p>
            <Button onClick={handleBecomeAffiliate} disabled={requesting} className="btn-primary gap-2">
              <Megaphone className="w-4 h-4" /> {t('profile.affiliate.requestAgain')}
            </Button>
          </div>
        ) : (
          <Button onClick={handleBecomeAffiliate} disabled={requesting} className="btn-primary gap-2">
            <Megaphone className="w-4 h-4" /> {requesting ? t('profile.affiliate.requesting') : t('profile.affiliate.request')}
          </Button>
        )}
      </div>
    )}
    </>
  );
};

export default ProfileAffiliatePanel;
