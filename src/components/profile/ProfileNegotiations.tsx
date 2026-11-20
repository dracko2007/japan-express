import React from 'react';
import { Handshake, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
import { negotiationService } from '@/services/negotiationService';
import { Negotiation } from '@/types/negotiation';
import { NavigateFunction } from 'react-router-dom';

interface ProfileNegotiationsProps {
  negotiations: Negotiation[];
  navigate: NavigateFunction;
}

const ProfileNegotiations: React.FC<ProfileNegotiationsProps> = ({
  negotiations,
  navigate,
}) => {
  return (
    <>
    {/* Negociações */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Handshake className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Negociações</h2>
      </div>
      {negotiations.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
            <Handshake className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Nenhuma negociação ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Use o botão "Negociar" no checkout para solicitar desconto na taxa ou no frete.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {negotiations.map((neg) => {
            const isExpiredClient = negotiationService.isExpired(neg);
            const isPending = neg.status === 'pending' && !isExpiredClient;
            const isApproved = (neg.status === 'approved' || neg.status === 'auto_approved');
            const isUsed = neg.status === 'used';
            const isRejected = neg.status === 'rejected';
            const isExpired = neg.status === 'expired' || isExpiredClient;
            const borderClass = isPending
              ? 'border-pink-200 bg-pink-50/30 dark:bg-pink-950/10'
              : isApproved
              ? 'border-green-200 bg-green-50/30 dark:bg-green-950/10'
              : isUsed
              ? 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/10'
              : isExpired
              ? 'border-gray-200 opacity-60'
              : 'border-red-200 bg-red-50/20 dark:bg-red-950/10';
            return (
              <div key={neg.id} className={`rounded-xl border p-4 ${borderClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">
                        {neg.type === 'ps_fee' ? '🤝 Taxa Personal Shopper' : '🚚 Frete'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
                        isPending ? 'bg-pink-100 text-pink-700 border-pink-300'
                        : isApproved ? 'bg-green-100 text-green-700 border-green-300'
                        : isUsed ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-red-100 text-red-700 border-red-300'
                      }`}>
                        {isPending && <><Hourglass className="w-3 h-3" /> Aguardando</>}
                        {isApproved && <><CheckCircle2 className="w-3 h-3" /> Aprovado</>}
                        {isUsed && <><CheckCircle2 className="w-3 h-3" /> Finalizado</>}
                        {isRejected && <><XCircle className="w-3 h-3" /> Recusado</>}
                        {isExpired && <><XCircle className="w-3 h-3" /> Expirado</>}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Desconto pedido: ¥{neg.requestedDiscountYen.toLocaleString()} em ¥{neg.originalAmountYen.toLocaleString()}
                    </p>
                    {(isApproved || isUsed) && neg.approvedDiscountYen != null && (
                      <p className={`text-xs font-semibold mt-1 ${isUsed ? 'text-blue-600' : 'text-green-600'}`}>
                        ✅ Desconto aprovado: ¥{neg.approvedDiscountYen.toLocaleString()} — Valor final: ¥{(neg.originalAmountYen - neg.approvedDiscountYen).toLocaleString()}
                      </p>
                    )}
                    {neg.adminNote && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{neg.adminNote}"</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(neg.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {isApproved && (
                    <button
                      onClick={() => {
                        negotiationService.markSeen(neg.id);
                        navigate('/checkout', { state: { activeNegId: neg.id } });
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                    >
                      Continuar pedido
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
};

export default ProfileNegotiations;
