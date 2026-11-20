import React from 'react';
import { formatPrice } from '@/utils/currency';
import { Message } from '@/components/kimiclaw/types';

interface KimiShippingResultsProps {
  msg: Message;
  t: (key: string) => string;
}

const KimiShippingResults: React.FC<KimiShippingResultsProps> = ({
  msg,
  t,
}) => {
  return (
    <>
    {/* SHIPPING CALCULATION RESULTS */}
    {msg.shippingResults && msg.shippingResults.length > 0 && (
      <div className="flex flex-col gap-1.5 mt-2 text-[11px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 px-2 font-bold text-foreground text-[10px]">{t('kimiclaw.shipping.carrier')}</th>
              <th className="text-right py-1 px-2 font-bold text-foreground text-[10px]">{t('kimiclaw.shipping.price')}</th>
            </tr>
          </thead>
          <tbody>
            {msg.shippingResults.map((option, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-2 text-left text-foreground">
                  <div className="font-semibold">{option.carrier}</div>
                  {option.daysEstimate && (
                    <div className="text-[10px] text-muted-foreground">~{option.daysEstimate} dias</div>
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="font-bold text-primary">
                    {formatPrice(option.basePrice, option.currency)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </>
  );
};

export default KimiShippingResults;
