import React from 'react';
import { ALL_PRESETS, VARIANT_PRESETS, UNIT_PRESETS } from '@/components/admin/productFormConstants';
import { Trash2, Plus } from 'lucide-react';
import { ProductVariant } from '@/types';

interface ProductVariantsSectionProps {
  variants: () => ProductVariant[];
  updateVariant: (id: string, patch: Partial<ProductVariant>) => void;
  canPrice: boolean;
  removeVariant: (id: string) => void;
  addVariant: () => void;
}

const ProductVariantsSection: React.FC<ProductVariantsSectionProps> = ({
  variants,
  updateVariant,
  canPrice,
  removeVariant,
  addVariant,
}) => {
  return (
    <>
    {/* Variantes de preço (Pequeno/Médio/Grande/Kit) */}
    <div>
      <label className="text-sm font-semibold block mb-2">Tamanhos / unidades & preços (¥)</label>
      <div className="space-y-2">
        {variants().map((v) => (
          <div key={v.id} className="flex items-center gap-2">
            <select
              value={ALL_PRESETS.includes(v.label) ? v.label : 'custom'}
              onChange={(e) => updateVariant(v.id, { label: e.target.value === 'custom' ? '' : e.target.value })}
              disabled={!canPrice}
              className="px-2 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
            >
              <optgroup label="Tamanhos">
                {VARIANT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
              <optgroup label="Unidades">
                {UNIT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
              <option value="custom">Outro…</option>
            </select>
            {!ALL_PRESETS.includes(v.label) && (
              <input
                value={v.label}
                onChange={(e) => updateVariant(v.id, { label: e.target.value })}
                placeholder="Ex: Kit 3 unidades"
                disabled={!canPrice}
                className="w-36 px-2 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
              />
            )}
            <input
              type="number"
              value={v.price || ''}
              onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })}
              placeholder="¥ preço"
              disabled={!canPrice}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60"
            />
            {variants().length > 1 && canPrice && (
              <button onClick={() => removeVariant(v.id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      {canPrice && (
        <button onClick={addVariant} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <Plus className="w-4 h-4" /> Adicionar opção
        </button>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {canPrice ? 'Preços em ienes (¥). O site converte automático para R$/€. O cliente escolhe o tamanho na página do produto.' : '🔒 Preço/custo só podem ser alterados por admin nível 3.'}
      </p>
    </div>
    </>
  );
};

export default ProductVariantsSection;
