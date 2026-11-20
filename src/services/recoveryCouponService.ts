import { authenticatedFetch } from '@/services/authenticatedFetch';

// Cupom de recuperação de carrinho (e-mail "seu carrinho ainda está esperando"): chance única.
// Só vale ao abrir o link do e-mail; a janela (24 h) começa na abertura (`api/_lib/recovery-coupon.js`).

export interface RecoveryCoupon {
  code: string;
  discountPercent: number;
  description?: string;
  expiryDate?: string;
}

export type OpenRecoveryResult =
  | { ok: true; coupon: RecoveryCoupon; windowEndsAt: number; replay: boolean }
  | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  recovery_link_required: 'Este cupom só vale pelo botão do e-mail de recuperação de carrinho. Abra o e-mail e toque em "Voltar ao carrinho".',
  recovery_window_closed: 'O prazo deste cupom acabou: ele vale por 24 horas depois que você abre o e-mail, e o link não abre de novo.',
  recovery_coupon_cpf_used: 'O cupom de recuperação de carrinho vale uma vez só e já foi usado neste CPF (ou conta).',
  recovery_coupon_used: 'O cupom de recuperação de carrinho vale uma vez só e já foi usado.',
  invalid_recovery_link: 'Este link não é válido. Use o botão do e-mail mais recente.',
  coupon_not_eligible: 'Este cupom é de outra conta. Entre com a conta que recebeu o e-mail.',
  coupon_already_used: 'Este cupom já foi usado.',
  coupon_unavailable: 'Este cupom não está mais disponível.',
  coupon_not_found: 'Cupom não encontrado.',
  verified_email_required: 'Confirme o e-mail da sua conta (link enviado ao cadastrar) para usar o cupom.',
  rate_limited: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
};

/** Mensagem para o cliente a partir do código de erro do servidor (vazio = não é erro de recuperação). */
export function recoveryErrorMessage(code?: string): string {
  return (code && MESSAGES[code]) || '';
}

/** Abre o link do e-mail (começa a janela do cupom). Exige login com e-mail verificado. */
export async function openRecoveryLink(link: string): Promise<OpenRecoveryResult> {
  try {
    const response = await authenticatedFetch('/api/recovery-open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ link }),
    });
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; coupon?: RecoveryCoupon; windowEndsAt?: number; replay?: boolean };
    if (!response.ok || payload.ok !== true || !payload.coupon || !Number.isFinite(payload.windowEndsAt)) {
      return { ok: false, error: payload.error || 'unknown' };
    }
    return { ok: true, coupon: payload.coupon, windowEndsAt: Number(payload.windowEndsAt), replay: payload.replay === true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
