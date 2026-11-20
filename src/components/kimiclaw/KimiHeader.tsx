import React from 'react';
import { Bot, X } from 'lucide-react';

interface KimiHeaderProps {
  t: (key: string) => string;
  isAdmin: boolean;
  language: "pt" | "en" | "ja";
  setIsOpen: (value: React.SetStateAction<boolean>) => void;
}

const KimiHeader: React.FC<KimiHeaderProps> = ({
  t,
  isAdmin,
  language,
  setIsOpen,
}) => {
  return (
    <>
    {/* HEADER */}
    <div className="p-4 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-soft relative">
          <Bot className="w-5 h-5 text-white" />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            {t('kimiclaw.title')}
            {isAdmin && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
                ADMIN
              </span>
            )}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {isAdmin
              ? (language === 'pt' ? 'Modo Admin — dashboard · pedidos · catálogo' : 'Admin Mode — dashboard · orders · catalog')
              : t('kimiclaw.subtitle')}
          </p>
        </div>
      </div>
      <button
        onClick={() => setIsOpen(false)}
        aria-label={t('kimiclaw.close')}
        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    </>
  );
};

export default KimiHeader;
