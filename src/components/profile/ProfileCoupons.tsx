import React from 'react';

import { Coupon } from '@/context/UserContext';

interface ProfileCouponsProps {
  t: (key: string) => string;
  activeCoupons: Coupon[];
  usedCoupons: Coupon[];
  expiredCoupons: Coupon[];
}

const ProfileCoupons: React.FC<ProfileCouponsProps> = ({
  t,
  activeCoupons,
  usedCoupons,
  expiredCoupons,
}) => {
  return (
    <>
    {/* Coupons */}
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display text-base font-semibold text-foreground">
          {t('profile.coupons.title')}
        </h2>
      </div>

      {activeCoupons.length > 0 ? (
        <div className="space-y-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('profile.coupons.active')}</h3>
          {activeCoupons.map((coupon) => (
            <div 
              key={coupon.id}
              className="p-4 rounded-xl border-2 border-dashed border-primary bg-primary/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-bold text-lg text-primary font-mono">{coupon.code}</p>
                  <p className="text-sm text-foreground">{coupon.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('profile.coupons.validUntil')} {new Date(coupon.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-2xl text-primary">
                    {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `¥${coupon.discount}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('profile.coupons.discount')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">
          {t('profile.coupons.none')}
        </p>
      )}

      {(usedCoupons.length > 0 || expiredCoupons.length > 0) && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-semibold text-muted-foreground mb-3 text-sm">
            {t('profile.coupons.expired')}
          </h3>
          <div className="space-y-2">
            {[...usedCoupons, ...expiredCoupons].map((coupon) => (
              <div 
                key={coupon.id}
                className="p-3 rounded-lg bg-secondary/30 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm">{coupon.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {coupon.isUsed ? t('profile.coupons.used') : t('profile.coupons.expiredLabel')}
                    </p>
                  </div>
                  <p className="text-sm">
                    {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `¥${coupon.discount}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ProfileCoupons;
