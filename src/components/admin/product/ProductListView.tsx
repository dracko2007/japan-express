import React from 'react';
import { Search, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { Product } from '@/types';

interface ProductListViewProps {
  grouped: { items: Product[]; id: string; label: string; icon: string; }[];
  setSearchQuery: (value: React.SetStateAction<string>) => void;
  setFilterCat: (value: React.SetStateAction<string>) => void;
  openEdit: (p: Product) => void;
  remove: (p: Product) => Promise<void>;
}

const ProductListView: React.FC<ProductListViewProps> = ({
  grouped,
  setSearchQuery,
  setFilterCat,
  openEdit,
  remove,
}) => {
  return (
    <>
    {/* Lista */}
    {grouped.length === 0 && (
      <div className="text-center py-16 text-muted-foreground">
        <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum produto encontrado</p>
        <button onClick={() => { setSearchQuery(''); setFilterCat('all'); }} className="text-xs text-primary hover:underline mt-1">
          Limpar filtros
        </button>
      </div>
    )}
    <div className="space-y-8">
      {grouped.map((group) => (
        <div key={group.id}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <span className="text-lg">{group.icon}</span> {group.label}
            <span className="text-xs font-normal">({group.items.length})</span>
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((p) => (
                <div key={p.id} className={`bg-card border rounded-xl overflow-hidden flex shadow-sm ${p.hidden ? 'border-dashed border-gray-300 opacity-70' : 'border-border'}`}>
                  <div className="w-24 h-24 bg-secondary/40 flex-shrink-0 relative">
                    {p.image ? (
                      <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    {p.discountPercent ? (
                      <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-br">-{p.discountPercent}%</span>
                    ) : null}
                  </div>
                  <div className="p-3 flex-1 min-w-0 flex flex-col">
                    <p className="font-semibold text-sm leading-tight line-clamp-2 flex items-center gap-1 flex-wrap">
                      {p.hidden && <span className="text-[9px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded shrink-0">OCULTO</span>}
                      {p.stock && !p.stock.unlimited && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${p.stock.quantity === 0 ? 'bg-red-600 text-white' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                          {p.stock.quantity === 0 ? 'ESGOTADO' : `${p.stock.quantity} un.`}
                        </span>
                      )}
                      {p.promoGift && p.promoGift.buyQuantity > 0 && (
                        <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded shrink-0">🎁 PROMO</span>
                      )}
                      {p.name}
                    </p>
                    {p.sku && (
                      <p className="text-[10px] font-mono text-muted-foreground/80 tracking-wide">SKU: {p.sku}</p>
                    )}
                    {(p.salesCount || 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">📊 {p.salesCount!.toLocaleString('pt-BR')} vendido{p.salesCount === 1 ? '' : 's'}</p>
                    )}
                    {p.discountPercent ? (
                      <p className="text-xs mt-1">
                        <s className="text-gray-400">¥{p.prices.small.toLocaleString()}</s>{' '}
                        <span className="text-red-600 font-bold">¥{Math.round(p.prices.small * (1 - p.discountPercent / 100)).toLocaleString()}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-primary font-bold mt-1">¥ {p.prices.small.toLocaleString()}</p>
                    )}
                    <div className="mt-auto flex gap-1 pt-2">
                      <button onClick={() => openEdit(p)} className="flex-1 text-xs py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center gap-1">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => remove(p)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>
      ))}
    </div>

    </>
  );
};

export default ProductListView;
