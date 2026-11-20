import React from 'react';
import type { PaymentSettings } from '@/services/paymentSettingsService';
import { CreditCard, Landmark, Wallet, Smartphone } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface OrderReviewPaymentMethodProps {
  paymentMethod: string;
  setPaymentMethod: (value: React.SetStateAction<string>) => void;
  isJapan: boolean;
  paySettings: PaymentSettings;
  grandTotalYen: number | undefined;
  WISE_INVITE_LINK: "https://wise.com/invite/ahpc/juniorcelsotadaos";
}

const OrderReviewPaymentMethod: React.FC<OrderReviewPaymentMethodProps> = ({
  paymentMethod,
  setPaymentMethod,
  isJapan,
  paySettings,
  grandTotalYen,
  WISE_INVITE_LINK,
}) => {
  return (
    <>
    {/* Payment Method Selection */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8 print:hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-sans text-xl font-bold text-foreground">
          Selecione o Método de Pagamento
        </h2>
      </div>

      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
        <div className="space-y-4">
          {isJapan ? (
            <>
              {/* PayPay Option for Japan */}
              <div className={cn(
                "flex items-start space-x-3 p-4 rounded-xl border-2 transition cursor-pointer",
                paymentMethod === 'paypay' ? "border-pink-500 bg-pink-50/50" : "border-border hover:border-gray-300"
              )}>
                <RadioGroupItem value="paypay" id="paypay" className="mt-1" />
                <Label htmlFor="paypay" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📱</span>
                    <span className="font-bold text-base text-gray-800">PayPay</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pague de forma rápida e instantânea usando o aplicativo PayPay via QR Code na próxima tela.
                  </p>
                </Label>
              </div>

              {/* Bank Transfer Option for Japan */}
              <div className={cn(
                "flex items-start space-x-3 p-4 rounded-xl border-2 transition cursor-pointer",
                paymentMethod === 'yucho' ? "border-pink-500 bg-pink-50/50" : "border-border hover:border-gray-300"
              )}>
                <RadioGroupItem value="yucho" id="yucho" className="mt-1" />
                <Label htmlFor="yucho" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Landmark className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-base text-gray-800">Depósito Bancário (Yucho Bank / ゆうちょ銀行)</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Faça a transferência para nossa conta no Yucho Bank (Paula Shiokawa). As instruções estarão na próxima tela.
                  </p>
                </Label>
              </div>
            </>
          ) : (
            <>
              {/* Wise Option (transferência internacional) — principal */}
              {paySettings.wiseEnabled ? (
              <div className={cn(
                "flex items-start space-x-3 p-4 rounded-xl border-2 transition cursor-pointer",
                paymentMethod === 'wise' ? "border-emerald-500 bg-emerald-50/50" : "border-border hover:border-gray-300"
              )}>
                <RadioGroupItem value="wise" id="wise" className="mt-1" />
                <Label htmlFor="wise" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-base text-gray-800">Wise — pague com PIX</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você paga em <strong>reais, por PIX</strong>, dentro da Wise. Ela converte e envia
                    os ienes para a loja. O link de pagamento aparece na próxima tela.
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
                      <span className="mt-0.5">💱</span>
                      <span>
                        No campo <strong>Valor</strong> do Wise, insira{' '}
                        <strong className="text-emerald-900">¥ {grandTotalYen.toLocaleString()}</strong>{' '}
                        (ienes). A Wise converte automaticamente para a sua moeda.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 w-fit">
                      <span>ℹ️</span>
                      <span>Taxa Wise variável (~4%) — <strong>sem IOF</strong></span>
                    </div>
                  </div>
                  {/* Aviso: não tem Wise? Cadastre-se */}
                  {paymentMethod === 'wise' && (
                    <a
                      href={WISE_INVITE_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg px-3 py-2 transition-colors"
                    >
                      <span>🌍 Não tem Wise? Cadastre-se aqui — é <strong>rápido e fácil</strong>!</span>
                      <span className="shrink-0">↗</span>
                    </a>
                  )}
                </Label>
              </div>
              ) : (
                <div className="flex items-start space-x-3 p-4 rounded-xl border-2 border-border opacity-60 cursor-not-allowed">
                  <RadioGroupItem value="wise" id="wise" className="mt-1" disabled />
                  <Label htmlFor="wise" className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-5 h-5 text-gray-400" />
                      <span className="font-bold text-base text-gray-600">Wise (Transferência Internacional)</span>
                      <span className="text-[10px] bg-gray-400 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">Em manutenção</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pagamento via Wise em manutenção. Volta em breve!
                    </p>
                  </Label>
                </div>
              )}

              {/* PIX direto. Fica DESLIGADO no painel: a remessa para o Japão
                  come IOF mais taxa de conversão, e o mesmo PIX pago dentro da
                  Wise não paga IOF — o caminho existe, só não é este.

                  Quando desligado a opção não é desenhada. Um botão cinza
                  "em manutenção" num site novo o cliente lê como site quebrado,
                  e ele não vai deduzir sozinho que o PIX está logo acima, na Wise.
                  O código fica: religar é trocar `pixEnabled` no painel.

                  Não precisa de guarda contra ficar selecionado e invisível: o
                  efeito da linha ~97 já troca para o primeiro método ativo. */}
              {paySettings.pixEnabled && (
              <div className={cn(
                "flex items-start space-x-3 p-4 rounded-xl border-2 transition cursor-pointer",
                paymentMethod === 'pix' ? "border-pink-500 bg-pink-50/50" : "border-border hover:border-gray-300"
              )}>
                <RadioGroupItem value="pix" id="pix" className="mt-1" />
                <Label htmlFor="pix" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-5 h-5 text-pink-600" />
                    <span className="font-bold text-base text-gray-800">PIX</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pague via PIX com QR Code ou Copia e Cola — mostraremos na próxima tela.
                  </p>
                </Label>
              </div>
              )}

              {/* Credit Card Option (Stripe) */}
              {paySettings.cardEnabled ? (
              <div className={cn(
                "flex items-start space-x-3 p-4 rounded-xl border-2 transition cursor-pointer",
                paymentMethod === 'card' ? "border-indigo-500 bg-indigo-50/50" : "border-border hover:border-gray-300"
              )}>
                <RadioGroupItem value="card" id="card" className="mt-1" />
                <Label htmlFor="card" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-base text-gray-800">Cartão de Crédito</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pague com cartão de crédito de forma segura via Stripe. Confirmação instantânea.
                  </p>
                </Label>
              </div>
              ) : (
                <div className="flex items-start space-x-3 p-4 rounded-xl border-2 border-border opacity-60 cursor-not-allowed">
                  <RadioGroupItem value="card" id="card" className="mt-1" disabled />
                  <Label htmlFor="card" className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <span className="font-bold text-base text-gray-600">Cartão de Crédito</span>
                      <span className="text-[10px] bg-gray-400 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">Em manutenção</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pagamento com cartão em manutenção. Volta em breve!
                    </p>
                  </Label>
                </div>
              )}
            </>
          )}
        </div>
      </RadioGroup>
    </div>

    </>
  );
};

export default OrderReviewPaymentMethod;
