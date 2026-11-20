import React from 'react';
import type { CartSplit } from '@/utils/localStock';
import { setShipAllFromJapan } from '@/utils/localStock';

interface CheckoutShippingModeProps {
  shipChoiceOpen: boolean;
  split: CartSplit;
  formData: { name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; };
  setShipChoiceOpen: (value: React.SetStateAction<boolean>) => void;
  localKind: "japan" | "local" | "mixed";
}

const CheckoutShippingMode: React.FC<CheckoutShippingModeProps> = ({
  shipChoiceOpen,
  split,
  formData,
  setShipChoiceOpen,
  localKind,
}) => {
  return (
    <>
    {/* Forma de envio: separado (um pedido, dois envios) ou tudo junto do Japão */}
    {shipChoiceOpen && (
      <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="ship-choice-title">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
          <h2 id="ship-choice-title" className="font-display text-xl font-bold text-foreground">Como você prefere receber?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {split.localItems.length} {split.localItems.length === 1 ? 'item já está' : 'itens já estão'} no {formData.country}
            {split.japanItems.length > 0 ? ` e ${split.japanItems.length} ${split.japanItems.length === 1 ? 'vem' : 'vêm'} do Japão` : ''}.
          </p>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => { setShipAllFromJapan(false); setShipChoiceOpen(false); }}
              className={`w-full rounded-xl border-2 p-4 text-left transition hover:bg-emerald-100 ${localKind !== 'japan' ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}
            >
              <span className="block font-bold text-emerald-900">{split.japanItems.length > 0 ? 'Enviar separado' : `Enviar do ${formData.country}`}</span>
              <span className="block text-xs text-emerald-800">
                {split.japanItems.length > 0
                  ? `Um pedido e um pagamento só, em dois envios: os itens do ${formData.country} saem de lá com o frete nacional e os do Japão saem do Japão com o frete internacional.`
                  : `Os itens saem de lá com o frete nacional, sem taxas de importação.`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setShipAllFromJapan(true); setShipChoiceOpen(false); }}
              className={`w-full rounded-xl border-2 p-4 text-left transition hover:bg-secondary/50 ${localKind === 'japan' ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}
            >
              <span className="block font-bold text-foreground">Enviar tudo junto do Japão</span>
              <span className="block text-xs text-muted-foreground">
                Um envio só, tudo sai do Japão. Todos os itens passam a usar o preço e o frete do Japão.
              </span>
            </button>
          </div>
          <button type="button" onClick={() => setShipChoiceOpen(false)} className="mt-4 w-full text-center text-sm text-muted-foreground hover:underline">Fechar</button>
        </div>
      </div>
    )}
    </>
  );
};

export default CheckoutShippingMode;
