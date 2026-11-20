import React, { useEffect, useState } from 'react';
import { formatCountdown } from '@/utils/countdown';

interface RecoveryCountdownProps {
  /** Fim da janela do cupom (ms desde 1970). */
  endsAt: number;
  /** Chamado uma vez, quando o contador chega a zero. */
  onExpire?: () => void;
  className?: string;
}

/** Contagem regressiva ao vivo (HH:MM:SS) até o fim da janela do cupom de recuperação. */
const RecoveryCountdown: React.FC<RecoveryCountdownProps> = ({ endsAt, onExpire, className }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let done = false;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (!done && current >= endsAt) {
        done = true;
        window.clearInterval(timer);
        onExpire?.();
      }
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
    // `onExpire` costuma ser uma função nova a cada render; só o fim da janela reinicia o relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return (
    <span role="timer" aria-label="Tempo restante do cupom" className={className}>
      {formatCountdown(endsAt - now)}
    </span>
  );
};

export default RecoveryCountdown;
