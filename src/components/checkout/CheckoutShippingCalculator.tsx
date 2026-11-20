import React from 'react';
import type { CartSplit } from '@/utils/localStock';
import { localCarrierLabel } from '../../../shared/local-stock.js';
import { formatPrice } from '@/utils/currency';
import ShippingCalculator from '@/components/shipping/ShippingCalculator';
import { CountryType } from '@/context/LanguageContext';
import { Hourglass, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CheckoutShippingCalculatorProps {
  anyLocal: boolean;
  mixedOrder: boolean;
  formData: { name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; };
  localShippingValue: number;
  localShippingPicked: { name: string; price: number; };
  localShippingOptions: { name: string; price: number; }[];
  currency: "BRL" | "JPY" | "EUR" | "USD";
  localShippingChoice: string;
  setLocalShippingChoice: (value: React.SetStateAction<string>) => void;
  localOrder: boolean;
  setSelectedShipping: (value: React.SetStateAction<{ carrier: string; cost: number; costYen: number; estimatedDays: string; }>) => void;
  couponDiscount: number;
  split: CartSplit;
  negIsPending: boolean;
  negActuallyExpired: boolean;
  setActiveNegId: (value: React.SetStateAction<string>) => void;
  setPsFeeDiscountYen: (value: React.SetStateAction<number>) => void;
  setShippingDiscountYen: (value: React.SetStateAction<number>) => void;
  selectedShipping: { carrier: string; cost: number; costYen: number; estimatedDays: string; };
}

const CheckoutShippingCalculator: React.FC<CheckoutShippingCalculatorProps> = ({
  anyLocal,
  mixedOrder,
  formData,
  localShippingValue,
  localShippingPicked,
  localShippingOptions,
  currency,
  localShippingChoice,
  setLocalShippingChoice,
  localOrder,
  setSelectedShipping,
  couponDiscount,
  split,
  negIsPending,
  negActuallyExpired,
  setActiveNegId,
  setPsFeeDiscountYen,
  setShippingDiscountYen,
  selectedShipping,
}) => {
  return (
    <>
    {/* Shipping Calculator Section */}
    <div className="pt-4 border-t border-border">
      {anyLocal && (
        <div className={mixedOrder ? 'mb-6' : ''}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">
            {mixedOrder ? `Envio nacional (itens do ${formData.country})` : 'Envio nacional'}
          </h3>
          {localShippingValue !== null ? (
            <div className="flex items-center justify-between rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
              <div>
                <p className="font-bold text-emerald-900">📍 {localCarrierLabel(formData.country)}{localShippingPicked && localShippingOptions.length > 1 ? ` • ${localShippingPicked.name}` : ''}</p>
                <p className="text-xs text-emerald-800">
                  {mixedOrder ? `Estes itens já estão no ${formData.country} e saem de lá: sem taxas de importação.` : `Seus produtos já estão no ${formData.country}: sem taxas de importação.`}
                </p>
              </div>
              <span className="font-extrabold text-emerald-900">
                {localShippingValue === 0 ? 'Grátis' : formatPrice(localShippingValue, currency, true)}
              </span>
            </div>
          ) : null}
          {/* Mais de uma opção e nenhuma casa com o cliente: ele escolhe. */}
          {localShippingValue === null && localShippingOptions.length > 0 && (
            <div className="space-y-2" role="radiogroup" aria-label="Frete nacional">
              <p className="text-sm text-muted-foreground">Escolha o frete:</p>
              {localShippingOptions.map((option) => (
                <label key={option.name} className="flex cursor-pointer items-center justify-between rounded-xl border-2 border-border p-3 hover:border-emerald-500">
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="local-shipping" checked={localShippingChoice === option.name} onChange={() => setLocalShippingChoice(option.name)} />
                    {option.name}
                  </span>
                  <span className="font-extrabold">{option.price === 0 ? 'Grátis' : formatPrice(option.price, currency, true)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {!localOrder && (
        <>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">
        {mixedOrder ? 'Envio do Japão (demais itens)' : 'Forma de Envio Internacional'}
      </h3>
      <ShippingCalculator 
        selectedPrefecture={formData.prefecture}
        onShippingSelect={setSelectedShipping}
        destinationCountry={formData.country as CountryType}
        couponDiscount={couponDiscount}
        items={mixedOrder ? split.japanItems : undefined}
      />
        </>
      )}
    </div>

    <div className="pt-4 border-t border-border">
      {negIsPending ? (
        <div className="w-full rounded-xl border-2 border-dashed border-pink-300 bg-pink-50 dark:bg-pink-950/20 p-4 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-pink-600 font-bold">
            <Hourglass className="w-4 h-4 animate-pulse" />
            Aguardando resposta da vendedora
          </div>
          <p className="text-xs text-pink-500">
            Expira em 24h · Acompanhe em Perfil → Negociações
          </p>
        </div>
      ) : negActuallyExpired ? (
        <div className="space-y-2">
          <div className="w-full rounded-xl border border-gray-300 bg-gray-50 dark:bg-gray-900/30 p-3 text-center text-xs text-muted-foreground">
            Negociação expirada sem resposta.
            <button
              type="button"
              onClick={() => { setActiveNegId(null); setPsFeeDiscountYen(0); setShippingDiscountYen(0); localStorage.removeItem('activeNegId'); }}
              className="block mx-auto mt-1 text-primary hover:underline font-semibold"
            >
              Limpar e tentar novamente
            </button>
          </div>
          <Button type="submit" className="w-full btn-primary rounded-xl py-6 text-lg font-bold" disabled={!selectedShipping || (anyLocal && localShippingValue === null)}>
            Ir para a Revisão do Pedido <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      ) : (

        <>
          <Button
            type="submit"
            className="w-full btn-primary rounded-xl py-6 text-lg font-bold"
            disabled={!selectedShipping || (anyLocal && localShippingValue === null)}
          >
            Ir para a Revisão do Pedido
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          {(!selectedShipping || (anyLocal && localShippingValue === null)) && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Selecione uma forma de entrega para continuar
            </p>
          )}
        </>
      )}
    </div>
    </>
  );
};

export default CheckoutShippingCalculator;
