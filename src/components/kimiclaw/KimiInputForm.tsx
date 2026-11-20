import React from 'react';
import { CornerDownLeft, Send } from 'lucide-react';

interface KimiInputFormProps {
  handleSendMessage: (e?: React.FormEvent) => void;
  inputValue: string;
  setInputValue: (value: React.SetStateAction<string>) => void;
  t: (key: string) => string;
  isTyping: boolean;
}

const KimiInputForm: React.FC<KimiInputFormProps> = ({
  handleSendMessage,
  inputValue,
  setInputValue,
  t,
  isTyping,
}) => {
  return (
    <>
    {/* INPUT FORM */}
    <form onSubmit={handleSendMessage} className="p-3 bg-card border-t border-border flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('kimiclaw.input_placeholder')}
          disabled={isTyping}
          className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground flex items-center gap-1 select-none pointer-events-none">
          <CornerDownLeft className="w-3.5 h-3.5 opacity-50" />
        </div>
      </div>
      <button
        type="submit"
        disabled={isTyping || !inputValue.trim()}
        className="p-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white disabled:bg-muted disabled:text-muted-foreground transition-colors shrink-0"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
    </>
  );
};

export default KimiInputForm;
