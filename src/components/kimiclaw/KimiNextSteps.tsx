import React from 'react';
import { ACTION_LABELS } from '@/components/kimiclaw/constants';
import { Message } from '@/components/kimiclaw/types';
import { AssistantAction } from '@/services/assistantTools';

interface KimiNextStepsProps {
  msg: Message;
  runAction: (action: AssistantAction) => void;
  language: "pt" | "en" | "ja";
}

const KimiNextSteps: React.FC<KimiNextStepsProps> = ({
  msg,
  runAction,
  language,
}) => {
  return (
    <>
    {/* PRÓXIMOS PASSOS SUGERIDOS PELO AGENTE */}
    {msg.actions && msg.actions.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {msg.actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => runAction(action)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              action === 'finalizar_compra'
                ? 'bg-primary hover:bg-primary/90 text-white shadow-soft'
                : 'bg-secondary hover:bg-secondary/80 text-foreground border border-border'
            }`}
          >
            {ACTION_LABELS[action]?.[(['pt', 'en', 'ja'].includes(language) ? language : 'pt') as 'pt' | 'en' | 'ja'] ?? action}
          </button>
        ))}
      </div>
    )}

    </>
  );
};

export default KimiNextSteps;
