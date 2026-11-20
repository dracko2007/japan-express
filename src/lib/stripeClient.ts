import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/** Uma só instância do Stripe.js para o formulário de pagamento e para a página de retorno. `null` sem chave configurada. */
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
