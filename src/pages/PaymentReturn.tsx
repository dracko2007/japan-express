import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { stripePromise } from '@/lib/stripeClient';
import { pendingCheckout } from '@/utils/pendingCheckout';
import { useFinalizeOrder } from '@/hooks/useFinalizeOrder';

type View = 'loading' | 'received' | 'failed';

/**
 * Volta de um pagamento feito em outro site (Klarna, MB WAY, Scalapay...). O Stripe devolve o cliente aqui com o
 * `payment_intent_client_secret` na URL. Quem manda no resultado é o Stripe (consultado aqui) e, para o registro do
 * pedido, o webhook: esta tela só mostra o resultado e encerra a compra no aparelho.
 */
const PaymentReturn: React.FC = () => {
  const { search } = useLocation();
  const finalizeOrder = useFinalizeOrder();
  const [view, setView] = useState<View>('loading');
  const started = useRef(false);

  const params = new URLSearchParams(search);
  const secret = params.get('payment_intent_client_secret');
  const orderNumber = params.get('pedido');

  useEffect(() => {
    if (started.current) return; // o modo estrito roda o efeito duas vezes: encerrar a compra só pode acontecer uma
    started.current = true;
    let active = true;
    (async () => {
      try {
        const stripe = stripePromise ? await stripePromise : null;
        if (!secret || !stripe) { if (active) setView('failed'); return; }
        const { paymentIntent, error } = await stripe.retrievePaymentIntent(secret);
        if (!active) return;
        if (error || !paymentIntent) { setView('failed'); return; }
        // `processing`: o pagamento foi aceito e a confirmação final chega pelo webhook (igual ao cartão na própria tela).
        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          const pending = pendingCheckout.read(orderNumber);
          if (pending) { finalizeOrder(pending.order, pending.isGuest); return; }
          setView('received'); // outro aparelho ou aba: o pedido existe no servidor, só não temos o rascunho aqui
          return;
        }
        setView('failed');
      } catch {
        if (active) setView('failed');
      }
    })();
    return () => { active = false; };
  }, [secret, orderNumber, finalizeOrder]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center" role="status" aria-live="polite">
          {view === 'loading' && (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
              <h1 className="mt-4 font-display text-lg font-semibold">Confirmando o seu pagamento...</h1>
              <p className="mt-1 text-sm text-muted-foreground">Não feche esta página.</p>
            </>
          )}
          {view === 'received' && (
            <>
              <CheckCircle className="mx-auto h-8 w-8 text-green-600" aria-hidden="true" />
              <h1 className="mt-4 font-display text-lg font-semibold">Pagamento recebido</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {orderNumber ? `Pedido ${orderNumber}: ` : ''}o seu pagamento foi aprovado e o pedido é atualizado em instantes.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button asChild><Link to="/perfil?aba=pedidos">Ver meus pedidos</Link></Button>
                <Button asChild variant="outline"><Link to="/">Voltar à loja</Link></Button>
              </div>
            </>
          )}
          {view === 'failed' && (
            <>
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
              <h1 className="mt-4 font-display text-lg font-semibold">O pagamento não foi concluído</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode tentar de novo pelo carrinho, com o mesmo método ou outro.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button asChild><Link to="/carrinho">Voltar ao carrinho</Link></Button>
                <Button asChild variant="outline"><Link to="/perfil?aba=pedidos">Ver meus pedidos</Link></Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentReturn;
