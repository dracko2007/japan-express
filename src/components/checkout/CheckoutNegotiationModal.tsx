import React from 'react';
import { Handshake, X } from 'lucide-react';

interface CheckoutNegotiationModalProps {
  negModalType: "ps_fee" | "shipping";
  setNegModalType: (value: React.SetStateAction<"ps_fee" | "shipping">) => void;
  setNegRequest: (value: React.SetStateAction<string>) => void;
  setNegNote: (value: React.SetStateAction<string>) => void;
  psFeeQty: number;
  psFeeYen: number;
  selectedShipping: { carrier: string; cost: number; costYen: number; estimatedDays: string; };
  maxAutoApprovable: number;
  negRequest: string;
  negNote: string;
  handleNegotiationSubmit: () => Promise<void>;
  negSubmitting: boolean;
}

const CheckoutNegotiationModal: React.FC<CheckoutNegotiationModalProps> = ({
  negModalType,
  setNegModalType,
  setNegRequest,
  setNegNote,
  psFeeQty,
  psFeeYen,
  selectedShipping,
  maxAutoApprovable,
  negRequest,
  negNote,
  handleNegotiationSubmit,
  negSubmitting,
}) => {
  return (
    <>
    {/* Modal de negociação */}
    {negModalType && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-lg text-foreground">
                {negModalType === 'ps_fee' ? 'Negociar Taxa Personal Shopper' : 'Negociar Frete'}
              </h3>
            </div>
            <button onClick={() => { setNegModalType(null); setNegRequest(''); setNegNote(''); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-secondary/40 rounded-xl p-4 mb-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {negModalType === 'ps_fee' ? `Taxa PS (${psFeeQty} itens × ¥1.000)` : 'Frete selecionado'}
              </span>
              <span className="font-semibold">
                ¥{(negModalType === 'ps_fee' ? psFeeYen : (selectedShipping?.costYen || 0)).toLocaleString()}
              </span>
            </div>
            {negModalType === 'ps_fee' && (
              <p className="text-xs text-primary font-medium">
                Desconto até ¥{maxAutoApprovable.toLocaleString()} é aprovado automaticamente.
              </p>
            )}
            {negModalType === 'shipping' && (
              <p className="text-xs text-pink-500 font-medium">
                Desconto no frete requer aprovação manual da vendedora.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Desconto solicitado (em ienes ¥)
              </label>
              <input
                type="number"
                min="1"
                value={negRequest}
                onChange={e => setNegRequest(e.target.value)}
                placeholder="Ex: 500"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Mensagem (opcional)
              </label>
              <textarea
                rows={2}
                value={negNote}
                onChange={e => setNegNote(e.target.value)}
                placeholder="Ex: Compra recorrente, posso fechar logo..."
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setNegModalType(null); setNegRequest(''); setNegNote(''); }}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleNegotiationSubmit}
              disabled={negSubmitting || !negRequest}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {negSubmitting ? 'Enviando...' : 'Enviar Proposta'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="gradient-hero py-16">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Finalizar Pedido
          </h1>
          <p className="text-muted-foreground text-lg">
            Preencha seus dados para receber os produtos importados do Japão
          </p>
        </div>
      </div>
    </div>

    </>
  );
};

export default CheckoutNegotiationModal;
