import React from 'react';
import { PAYMENT_BRAND_ICONS, type PaymentBrandIcon } from '@/components/layout/paymentBrandIcons';

export interface PaymentMethodsState {
  cardEnabled: boolean;
  wiseEnabled: boolean;
  pixEnabled: boolean;
}

interface PaymentMethodsProps {
  t: (key: string) => string;
  methods: PaymentMethodsState;
}

const Badge: React.FC<{ icon: PaymentBrandIcon; dimmed?: boolean }> = ({ icon, dimmed = false }) => (
  <li className={`flex h-9 w-11 items-center justify-center rounded-md bg-white/10 ${dimmed ? 'opacity-50' : ''}`}>
    <svg viewBox="0 0 24 24" role="img" aria-label={icon.label} className="h-5 w-auto max-w-[2rem] fill-current text-white">
      <title>{icon.label}</title>
      <path d={icon.path} />
    </svg>
  </li>
);

/**
 * Formas de pagamento no rodapé, com os logos. Só aparece o que o checkout realmente aceita
 * (as mesmas configurações que o checkout lê). Pix: próprio (quando ligado), "via Wise" (o Wise oferece o Pix na página de
 * pagamento) ou apagado e "em breve" quando nenhum dos dois está ligado.
 */
const PaymentMethods: React.FC<PaymentMethodsProps> = ({ t, methods }) => {
  // Pix próprio ligado, ou Pix pela página de pagamento do Wise (enquanto o Wise estiver ligado).
  const pixAvailable = methods.pixEnabled || methods.wiseEnabled;
  return (
  <div className="pt-3">
    <p className="mb-2 text-sm font-semibold">{t('footer.payments')}</p>
    <ul className="flex flex-wrap items-center gap-2">
      {methods.cardEnabled && (
        <>
          <Badge icon={PAYMENT_BRAND_ICONS.visa} />
          <Badge icon={PAYMENT_BRAND_ICONS.mastercard} />
          <Badge icon={PAYMENT_BRAND_ICONS.amex} />
          <Badge icon={PAYMENT_BRAND_ICONS.diners} />
        </>
      )}
      {methods.wiseEnabled && <Badge icon={PAYMENT_BRAND_ICONS.wise} />}
      <Badge icon={PAYMENT_BRAND_ICONS.pix} dimmed={!pixAvailable} />
    </ul>
    {!methods.pixEnabled && (
      <p className="mt-2 text-xs text-accent-foreground/70">
        Pix: {methods.wiseEnabled ? t('footer.paymentPixViaWise') : t('footer.paymentSoon')}
      </p>
    )}
  </div>
  );
};

export default PaymentMethods;
