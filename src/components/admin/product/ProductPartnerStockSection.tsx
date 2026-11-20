import React from 'react';
import { LocalStockFields } from '@/components/admin/LocalStockFields';
import { Gift } from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import { convertYen as fxConvertYen } from '@/services/fxService';
import { PACKAGE_SAFETY_MARGIN_CM } from '@/utils/shippingDimensions';
import { Product, ProductVariant } from '@/types';

interface ProductPartnerStockSectionProps {
  editing: Product;
  setEditing: (value: React.SetStateAction<Product>) => void;
  marginPct: 100;
  variants: () => ProductVariant[];
  canPrice: boolean;
  dimMm: (cm?: number) => number | "";
  updatePackageDimension: (field: "widthCm" | "lengthCm" | "heightCm", valueMm: string) => void;
}

const ProductPartnerStockSection: React.FC<ProductPartnerStockSectionProps> = ({
  editing,
  setEditing,
  marginPct,
  variants,
  canPrice,
  dimMm,
  updatePackageDimension,
}) => {
  return (
    <>
    {/* Estoque em outro país (empresa parceira): preço fixo na moeda de lá */}
    <LocalStockFields value={editing.localStock} onChange={(localStock) => setEditing({ ...editing, localStock })} />

    {/* Promoção: Compre X, ganhe +1 deste mesmo produto grátis */}
    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-3">
      <label className="text-sm font-semibold flex items-center gap-1.5">
        <Gift className="w-4 h-4 text-purple-500" /> Promoção: Compre X, ganhe +1 grátis
      </label>

      {/* Produto que será dado = sempre este mesmo */}
      <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg px-3 py-2">
        {editing.image && <img src={editing.image} alt={editing.name} className="w-8 h-8 rounded object-cover shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-purple-800 dark:text-purple-200 truncate">{editing.name || '(nome do produto)'}</p>
          <p className="text-[10px] text-purple-600">Este produto será o brinde</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Compre quantos para ganhar +1? (0 = sem promo)</label>
          <input
            type="number"
            min={0}
            value={editing.promoGift?.buyQuantity ?? 0}
            onChange={(e) => {
              const qty = Number(e.target.value) || 0;
              setEditing({ ...editing, promoGift: qty > 0
                ? { buyQuantity: qty, giftProductId: editing.id, giftProductName: editing.name, minOrderValueYen: editing.promoGift?.minOrderValueYen }
                : undefined });
            }}
            placeholder="Ex: 2"
            className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>

        {editing.promoGift && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Gasto mínimo no carrinho (¥) — 0 = sem mínimo</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                value={editing.promoGift.minOrderValueYen ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setEditing({ ...editing, promoGift: { ...editing.promoGift!, minOrderValueYen: val > 0 ? val : undefined } });
                }}
                placeholder="Ex: 3000"
                className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
              {(editing.promoGift.minOrderValueYen ?? 0) > 0 && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  ≈ <strong>{formatPrice(fxConvertYen(editing.promoGift.minOrderValueYen!, 'BRL'), 'BRL')}</strong>
                  {' · '}
                  <strong>{formatPrice(fxConvertYen(editing.promoGift.minOrderValueYen!, 'EUR'), 'EUR')}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {editing.promoGift && editing.promoGift.buyQuantity > 0 && (
        <p className="text-[11px] text-purple-700 dark:text-purple-300">
          🎁 Compre {editing.promoGift.buyQuantity}x
          {editing.promoGift.minOrderValueYen ? ` (ou gaste ¥${editing.promoGift.minOrderValueYen.toLocaleString()} no total)` : ''}
          {' '}→ ganhe +1 <strong>{editing.name || 'este produto'}</strong> grátis
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">0 = sem promoção ativa.</p>
    </div>

    {/* Custo + margem de lucro — SÓ ADMIN */}
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
      <label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
        🔒 Custo & Margem <span className="text-[10px] font-normal text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">interno</span>
      </label>

      <div className="flex items-center gap-2">
        {/* Custo de aquisição */}
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground">Custo (¥)</span>
          <input
            type="number"
            value={editing.cost || ''}
            onChange={(e) => {
              const cost = Number(e.target.value);
              if (marginPct > 0 && cost > 0) {
                const selling = Math.round(cost * (1 + marginPct / 100));
                const vs = variants().map((v, i) => i === 0 ? { ...v, price: selling } : v);
                setEditing({ ...editing, cost, variants: vs, prices: { ...editing.prices, small: selling } });
              } else {
                setEditing({ ...editing, cost });
              }
            }}
            placeholder="ex: 500"
            disabled={!canPrice}
            className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-background disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          />
        </div>

        {/* Preço de venda calculado */}
        <div className="shrink-0">
          <span className="text-[11px] text-muted-foreground">Venda (¥)</span>
          <div className={`px-3 py-2 rounded-lg border text-sm font-semibold min-w-[80px] text-center ${
            editing.cost && marginPct > 0
              ? 'border-green-300 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
              : 'border-border bg-muted text-muted-foreground'
          }`}>
            {editing.cost && marginPct > 0
              ? `¥${Math.round(editing.cost * (1 + marginPct / 100)).toLocaleString()}`
              : '—'}
          </div>
        </div>
      </div>

      <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1.5">
        {editing.cost
          ? `Lucro: ¥${Math.round(editing.cost).toLocaleString()} · markup fixo 100% · O cliente NUNCA vê o custo.`
          : 'Preencha o custo para calcular o preço de venda automaticamente.'}
      </p>
    </div>

    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-3">
      <label className="text-sm font-semibold block mb-2">
        Medidas da embalagem para frete (mm)
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="text-[11px] text-muted-foreground">Largura (mm)</span>
          <input
            type="number"
            min={0}
            step="1"
            value={dimMm(editing.packageDimensionsCm?.widthCm)}
            onChange={(e) => updatePackageDimension('widthCm', e.target.value)}
            placeholder="ex: 54"
            className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-background text-sm"
          />
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground">Comprimento (mm)</span>
          <input
            type="number"
            min={0}
            step="1"
            value={dimMm(editing.packageDimensionsCm?.lengthCm)}
            onChange={(e) => updatePackageDimension('lengthCm', e.target.value)}
            placeholder="ex: 84"
            className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-background text-sm"
          />
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground">Altura (mm)</span>
          <input
            type="number"
            min={0}
            step="1"
            value={dimMm(editing.packageDimensionsCm?.heightCm)}
            onChange={(e) => updatePackageDimension('heightCm', e.target.value)}
            placeholder="ex: 192"
            className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-background text-sm"
          />
        </div>
      </div>
      <p className="text-[11px] text-orange-700 dark:text-orange-300 mt-2 leading-relaxed">
        Digite em <strong>milímetros</strong> (ex: 54 × 84 × 192 mm). O frete soma +{PACKAGE_SAFETY_MARGIN_CM}cm de margem. Fonte: {editing.packageDimensionsCm?.source || 'manual/nao informado'}.
      </p>
      <div className="mt-3">
        <span className="text-[11px] text-muted-foreground">Peso da embalagem (g)</span>
        <input
          type="number"
          min={0}
          step="1"
          value={editing.weightGrams ?? ''}
          onChange={(e) => setEditing({ ...editing, weightGrams: e.target.value === '' ? undefined : Number(e.target.value) })}
          placeholder="ex: 500"
          className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-background text-sm mt-1"
        />
        <label className="flex items-center gap-2 mt-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={editing.weightVerified === true}
            onChange={(e) => setEditing({ ...editing, weightVerified: e.target.checked })}
            className="w-4 h-4"
          />
          Peso conferido (pesei na balança / fonte confiável)
        </label>
        <p className="text-[11px] text-orange-700 dark:text-orange-300 mt-1">
          Peso do produto com o frasco/caixa dele. {editing.weightVerified
            ? 'Conferido: o frete usa o peso exato, sem margem.'
            : 'Não conferido: o frete soma 200 g de margem por unidade (produtos abaixo de 2 kg).'}
        </p>
      </div>
    </div>

    </>
  );
};

export default ProductPartnerStockSection;
