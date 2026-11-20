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

/** Mastercard: dois círculos (vermelho e amarelo) com a interseção laranja, como o logo de verdade. */
const MastercardMark: React.FC = () => (
  <svg viewBox="0 0 32 20" role="img" aria-label="Mastercard" className="h-5 w-auto">
    <title>Mastercard</title>
    <circle cx="11" cy="10" r="9" fill="#EB001B" />
    <circle cx="21" cy="10" r="9" fill="#F79E1B" />
    <path d="M16 2.52A9 9 0 0 1 16 17.48A9 9 0 0 1 16 2.52Z" fill="#FF5F00" />
  </svg>
);

const Badge: React.FC<{ icon: PaymentBrandIcon; dimmed?: boolean }> = ({ icon, dimmed = false }) => (
  <li
    className={`flex h-9 w-12 items-center justify-center rounded-md ${dimmed ? 'opacity-50' : ''}`}
    style={{ backgroundColor: icon.background ?? '#ffffff' }}
  >
    {icon.label === 'Mastercard' ? (
      <MastercardMark />
    ) : (
      <svg viewBox="0 0 24 24" role="img" aria-label={icon.label} className="h-5 w-auto max-w-[2rem]" fill={icon.color}>
        <title>{icon.label}</title>
        <path d={icon.path} />
      </svg>
    )}
  </li>
);

/** Método sem logo no nosso pacote: o nome em texto, num selo neutro (sem imitar a marca). */
const TextBadge: React.FC<{ label: string }> = ({ label }) => (
  <li className="flex h-9 min-w-[3rem] items-center justify-center rounded-md bg-white/10 px-2.5 text-xs font-semibold text-white">{label}</li>
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
    {methods.cardEnabled && (
      <>
        {/* Outros métodos que o Stripe oferece no pagamento: aparecem conforme o país e o aparelho do cliente. */}
        <p className="mb-2 mt-3 text-xs text-accent-foreground/70">{t('footer.paymentMore')}</p>
        <ul className="flex flex-wrap items-center gap-2">
          <Badge icon={PAYMENT_BRAND_ICONS.jcb} />
          <Badge icon={PAYMENT_BRAND_ICONS.applepay} />
          <Badge icon={PAYMENT_BRAND_ICONS.googlepay} />
          <TextBadge label="Link" />
          <TextBadge label="MB WAY" />
          <TextBadge label="Scalapay" />
        </ul>
      </>
    )}
  </div>
  );
};

export default PaymentMethods;
