import React from 'react';
import { Product } from '@/types';

interface ProductHomeFeatureSectionProps {
  editing: Product;
  setEditing: (value: React.SetStateAction<Product>) => void;
  products: Product[];
}

const ProductHomeFeatureSection: React.FC<ProductHomeFeatureSectionProps> = ({
  editing,
  setEditing,
  products,
}) => {
  return (
    <>
    {/* Em Destaque na home */}
    <div className="bg-secondary/40 border border-border rounded-lg p-3 flex flex-col justify-center col-span-2">
      <label className="text-sm font-semibold block mb-2 flex items-center gap-1.5">⭐ Em Destaque na Página Inicial</label>
      <button
        type="button"
        onClick={() => {
          const turningOn = !editing.featured;
          setEditing({
            ...editing,
            featured: turningOn,
            featuredAt: turningOn ? (editing.featuredAt || new Date().toISOString()) : undefined,
          });
        }}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
          editing.featured
            ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300'
        }`}
      >
        <span>{editing.featured ? '⭐ Em destaque' : '☆ Sem destaque'}</span>
        <span className={`w-9 h-5 rounded-full relative transition-colors ${editing.featured ? 'bg-amber-500' : 'bg-gray-400'}`}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-[left] ${editing.featured ? 'left-4' : 'left-0.5'}`} />
        </span>
      </button>
      {(() => {
        const featuredCount = products.filter(p => p.featured && p.id !== editing.id).length + (editing.featured ? 1 : 0);
        if (featuredCount > 4) {
          return (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1.5 leading-snug">
              ⚠️ {featuredCount} produtos em destaque. A home mostra <strong>4 por vez</strong> e alterna automaticamente <strong>a cada semana</strong>, dando vez aos próximos.
            </p>
          );
        }
        return (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
            {featuredCount}/4 em destaque. Aparece na seção "Em Destaque" da home. Acima de 4, alternam semanalmente.
          </p>
        );
      })()}
    </div>

    {/* Hero Carrossel (topo da home) */}
    <div className="bg-secondary/40 border border-border rounded-lg p-3 flex flex-col justify-center col-span-2">
      <label className="text-sm font-semibold block mb-2 flex items-center gap-1.5">🎬 Hero Carrossel (topo da home)</label>
      <button
        type="button"
        onClick={() => {
          const turningOn = !editing.heroCarousel;
          setEditing({
            ...editing,
            heroCarousel: turningOn,
            heroCarouselAt: turningOn ? (editing.heroCarouselAt || new Date().toISOString()) : undefined,
          });
        }}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
          editing.heroCarousel
            ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300'
        }`}
      >
        <span>{editing.heroCarousel ? '🎬 No hero' : '☆ Fora do hero'}</span>
        <span className={`w-9 h-5 rounded-full relative transition-colors ${editing.heroCarousel ? 'bg-rose-500' : 'bg-gray-400'}`}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-[left] ${editing.heroCarousel ? 'left-4' : 'left-0.5'}`} />
        </span>
      </button>
      {(() => {
        const heroCount = products.filter(p => p.heroCarousel && p.id !== editing.id).length + (editing.heroCarousel ? 1 : 0);
        return (
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
            {heroCount === 0
              ? 'O hero mostra a curadoria fixa padrão quando nada está marcado.'
              : <>{heroCount} marcado(s). O hero exibe <strong>4 por vez</strong> + a <strong>promoção de início</strong> (sempre). Acima de 4, <strong>sorteia 4 diferentes</strong> a cada visita, sem repetir.</>}
          </p>
        );
      })()}
    </div>

    {/* Restrição de destino + Origem */}
    <div className="space-y-2">
      <label className="text-sm font-semibold block">Restrição de venda por destino</label>
      <select
        value={editing.deliveryRestrict || ''}
        onChange={e => setEditing({ ...editing, deliveryRestrict: (e.target.value as Product['deliveryRestrict']) || undefined })}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
      >
        <option value="">Sem restrição (vende em qualquer destino)</option>
        <option value="exterior-only">🌍 Somente exterior — produto japonês, não vende dentro do Japão</option>
        <option value="japan-only">🇯🇵 Somente Japão — produto importado, vende só dentro do Japão</option>
      </select>
      <div className="flex items-center gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={!!editing.origin}
            onChange={e => setEditing({ ...editing, origin: e.target.checked ? 'importado' : undefined })}
            className="w-4 h-4 rounded accent-primary"
          />
          <span>📦 Marcar como <strong>Importado</strong> (produto nacional vendido no Japão — exibe badge na loja)</span>
        </label>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={!!editing.noPsFee}
            onChange={e => setEditing({ ...editing, noPsFee: e.target.checked || undefined })}
            className="w-4 h-4 rounded accent-primary"
          />
          <span>💸 <strong>Isentar taxa de Personal Shopper</strong> (¥1.000/un — não cobra essa taxa neste produto)</span>
        </label>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={!!editing.freeShippingSolo}
            onChange={e => setEditing({ ...editing, freeShippingSolo: e.target.checked || undefined })}
            className="w-4 h-4 rounded accent-primary"
          />
          <span>🚚 <strong>Frete grátis</strong> (só se este for o único produto do pedido, 1 unidade — se o cliente adicionar mais algo, o frete volta a ser cobrado)</span>
        </label>
      </div>
    </div>
    </>
  );
};

export default ProductHomeFeatureSection;
