import React from 'react';
import type { OrderRef } from '@/components/kimiclaw/types';
import { Message } from '@/components/kimiclaw/types';
import { UserProfile } from '@/context/UserContext';

interface KimiConsentActionsProps {
  msg: Message;
  user: UserProfile;
  respondedOrders: string[];
  handleConsentAction: (accept: boolean, order?: OrderRef) => Promise<void>;
  language: "pt" | "en" | "ja";
}

const KimiConsentActions: React.FC<KimiConsentActionsProps> = ({
  msg,
  user,
  respondedOrders,
  handleConsentAction,
  language,
}) => {
  return (
    <>
    {/* CONSENT PROMPT ACTION BUTTONS (somem após responder ou se já inscrito) */}
    {msg.isConsentPrompt &&
      !user?.whatsappMarketing &&
      !respondedOrders.includes(msg.orderToShare?.orderNumber || msg.orderToShare?.id) && (
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => handleConsentAction(true, msg.orderToShare)}
          className="text-[11px] font-bold bg-primary hover:bg-primary/95 text-white px-3 py-1.5 rounded-lg shadow-soft transition"
        >
          ✅ {language === 'pt' ? 'Sim, quero receber!' : 'Yes, subscribe me!'}
        </button>
        <button
          onClick={() => handleConsentAction(false, msg.orderToShare)}
          className="text-[11px] font-semibold bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-lg transition"
        >
          ❌ {language === 'pt' ? 'Não, obrigado' : 'No, thanks'}
        </button>
      </div>
    )}

    </>
  );
};

export default KimiConsentActions;
