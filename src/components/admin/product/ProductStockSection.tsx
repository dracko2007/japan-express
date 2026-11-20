import React from 'react';
import { Infinity as InfinityIcon } from 'lucide-react';
import { Product } from '@/types';

interface ProductStockSectionProps {
  editing: Product;
  setEditing: (value: React.SetStateAction<Product>) => void;
}

const ProductStockSection: React.FC<ProductStockSectionProps> = ({
  editing,
  setEditing,
}) => {
  return (
    <>
    {/* Estoque */}
    <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
        <InfinityIcon className="w-4 h-4 text-slate-500" /> Estoque
      </label>
      <div className="flex gap-4 mb-3">
        {(['unlimited', 'limited'] as const).map((type) => {
          const isUnlimited = type === 'unlimited';
          const checked = isUnlimited ? (!editing.stock || editing.stock.unlimited) : (editing.stock && !editing.stock.unlimited);
          return (
            <label key={type} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="stockType"
                checked={!!checked}
                onChange={() => setEditing({ ...editing, stock: { unlimited: isUnlimited, quantity: editing.stock?.quantity || 0 } })}
                className="accent-primary"
              />
              <span className="text-sm font-medium">{isUnlimited ? 'Ilimitado' : 'Quantidade específica'}</span>
            </label>
          );
        })}
      </div>
      {editing.stock && !editing.stock.unlimited && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={editing.stock.quantity}
            onChange={(e) => setEditing({ ...editing, stock: { unlimited: false, quantity: Math.max(0, Number(e.target.value) || 0) } })}
            placeholder="Ex: 25"
            className="w-28 px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <span className="text-xs text-muted-foreground">unidades em estoque</span>
          {editing.stock.quantity === 0 && (
            <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">ESGOTADO — aparecerá Sold Out</span>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-1.5">
        A cada venda confirmada o estoque é descontado automaticamente. Ao chegar a zero aparece tarja "Sold Out".
      </p>
    </div>

    </>
  );
};

export default ProductStockSection;
