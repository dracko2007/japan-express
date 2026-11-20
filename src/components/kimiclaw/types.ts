import type { Product } from '@/types';
import type { AssistantAction } from '@/services/assistantTools';

export interface ShippingOption {
  carrier: string;
  basePrice: number;
  ratePerKg: number;
  currency: 'BRL' | 'JPY' | 'EUR' | 'USD';
  daysEstimate?: string;
}

/** O que o assistente usa do pedido ao pedir consentimento: identificador e telefone. */
export interface OrderRef {
  orderNumber?: string;
  id?: string;
  phone?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'kimi';
  text: string;
  timestamp: Date;
  agentSteps?: string[];
  isConsentPrompt?: boolean;
  orderToShare?: OrderRef;
  products?: Product[];
  shippingResults?: ShippingOption[];
  shippingCountry?: string;
  shippingWeight?: number;
  /** Botões de próximo passo sugeridos pelo agente. */
  actions?: AssistantAction[];
  /** Produtos/cotação desta resposta, enviados à IA na próxima pergunta (não aparece na tela). */
  agentContext?: string;
}
