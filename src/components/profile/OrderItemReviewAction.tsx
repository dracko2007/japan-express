import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { reviewService } from '@/services/reviewService';

// Badge/botão de "avaliar produto" no histórico de pedidos. canUserReview()
// agora é assíncrono (consulta o Firestore), então o status de "já avaliado"
// precisa ser resolvido em efeito próprio deste subcomponente — não dá para
// chamá-lo de forma síncrona dentro do .map() do componente pai.
export default function OrderItemReviewAction({
  userId,
  productId,
  reviewLabel,
  reviewedLabel,
  refreshKey,
  onReview,
}: {
  userId: string;
  productId: string;
  reviewLabel: string;
  reviewedLabel: string;
  refreshKey: number;
  onReview: () => void;
}) {
  const [reviewed, setReviewed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReviewed(null);
    reviewService.canUserReview(userId, productId).then((canReview) => {
      if (!cancelled) setReviewed(!canReview);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, productId, refreshKey]);

  if (reviewed === null) return null;

  return reviewed ? (
    <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1 shrink-0">
      <Star className="w-3.5 h-3.5 fill-green-600" /> {reviewedLabel}
    </span>
  ) : (
    <button
      onClick={onReview}
      className="text-[11px] font-semibold text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/5 flex items-center gap-1 shrink-0"
    >
      <Star className="w-3.5 h-3.5" /> {reviewLabel}
    </button>
  );
}
