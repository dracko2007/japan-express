import React from 'react';
import { ShoppingBag, UserPlus, Users } from 'lucide-react';
import type { PartnerStats as Stats } from '@/services/affiliateService';
import StatBars from '@/components/affiliate/StatBars';
import { DEVICE_LABEL, countryFlag, countryLabel, regionLabel } from '@/utils/partnerLabels';

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/**
 * Painel de um código (ou do total): quantos vieram, quantos se cadastraram, quantos compraram
 * (com e sem cadastro) e de onde / com que aparelho chegaram. Só estatística: nada de IP.
 */
const PartnerStats: React.FC<{ stats?: Stats | null; showCities?: boolean; title?: string }> = ({ stats, showCities = false, title }) => {
  if (!stats) return null;
  const withData = Object.values(stats.devices).some((count) => count > 0) || Object.values(stats.countries).some((count) => count > 0);
  return (
    <section aria-label={title || 'Origem das visitas'} className="space-y-4">
      {title && <h4 className="font-semibold">{title}</h4>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" aria-hidden /> Visitaram</p>
          <p className="text-2xl font-bold">{stats.visits}</p>
          <p className="text-[11px] text-muted-foreground">{stats.linkVisits} pelo link · {stats.codeVisits} pelo código</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><UserPlus className="h-3 w-3" aria-hidden /> Se cadastraram</p>
          <p className="text-2xl font-bold">{stats.signups}</p>
          <p className="text-[11px] text-muted-foreground">{pct(stats.signups, stats.visits)} de quem visitou</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs text-primary"><ShoppingBag className="h-3 w-3" aria-hidden /> Compraram</p>
          <p className="text-2xl font-bold text-primary">{stats.buyers.total}</p>
          <p className="text-[11px] text-muted-foreground">{pct(stats.buyers.total, stats.visits)} de quem visitou</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="mb-1 text-xs text-muted-foreground">Quem comprou</p>
          <p className="text-sm"><strong>{stats.buyers.registered}</strong> com cadastro</p>
          <p className="text-sm"><strong>{stats.buyers.guest}</strong> sem cadastro</p>
          <p className="text-[11px] text-muted-foreground">{stats.buyers.orders} pedido(s) pago(s)</p>
        </div>
      </div>

      {withData ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <StatBars
            title="Aparelho"
            data={stats.devices}
            label={(key) => DEVICE_LABEL[key] || key}
          />
          <StatBars title="Sistema" data={stats.os} />
          <StatBars title="País" data={stats.countries} label={(code) => `${countryFlag(code)} ${countryLabel(code)}`.trim()} />
          <StatBars title="Estado / região" data={stats.regions} label={regionLabel} />
          {showCities && <StatBars title="Cidade (aproximada)" data={stats.cities} />}
        </div>
      ) : (
        <p className="rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
          O local e o aparelho começam a aparecer a partir das próximas visitas. Visitas antigas só têm a contagem.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Local aproximado, pelo endereço de internet da pessoa; o endereço em si não é guardado. VPN ou rede de empresa podem mostrar o país errado.</p>
    </section>
  );
};

export default PartnerStats;
