import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { openRecoveryLink, recoveryErrorMessage, type RecoveryCoupon } from '@/services/recoveryCouponService';

interface Options {
  authReady: boolean;
  isAuthenticated: boolean;
  /** Link aberto: o cupom já está valendo no servidor; a tela aplica o desconto. */
  onOpened: (coupon: RecoveryCoupon, windowEndsAt: number) => void;
  onError: (message: string) => void;
  /** A janela do cupom acabou com a tela aberta. */
  onExpired: () => void;
}

const POLL_MS = 15_000;

/**
 * E-mail "seu carrinho ainda está esperando" (`/carrinho?rec=<código>.<chave>`).
 * Abrir o link começa a janela do cupom (2 h) e o desconto entra sozinho; sem login, leva ao login e
 * volta para este mesmo link. Digitar o código à mão não ativa o cupom (`api/_lib/recovery-coupon.js`).
 */
export function useRecoveryLink({ authReady, isAuthenticated, onOpened, onError, onExpired }: Options) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const link = searchParams.get('rec');
  const [endsAt, setEndsAt] = useState<number | null>(null);

  useEffect(() => {
    if (!link || !authReady) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/carrinho?rec=${encodeURIComponent(link)}` }, replace: true });
      return;
    }
    let cancelled = false;
    void openRecoveryLink(link).then((result) => {
      if (cancelled) return;
      // O link já fez o trabalho no servidor: tira o ?rec= da barra (recarregar não repete nada).
      const next = new URLSearchParams(searchParams);
      next.delete('rec');
      setSearchParams(next, { replace: true });
      if (result.ok === false) {
        onError(recoveryErrorMessage(result.error) || 'Não foi possível abrir o cupom agora. Tente de novo pelo botão do e-mail.');
        return;
      }
      setEndsAt(result.windowEndsAt);
      onOpened(result.coupon, result.windowEndsAt);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, authReady, isAuthenticated]);

  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => {
      if (Date.now() <= endsAt) return;
      window.clearInterval(timer); // avisa uma vez só, mesmo que a tela demore a re-renderizar
      setEndsAt(null);
      onExpired();
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return { endsAt };
}
