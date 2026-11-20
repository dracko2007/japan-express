import React from 'react';
import { X } from 'lucide-react';
import { Product } from '@/types';

interface ProductTagsSectionProps {
  editing: Product;
  removeTag: (tag: string) => void;
  tagInput: string;
  setTagInput: (value: React.SetStateAction<string>) => void;
  addTag: () => void;
  setEditing: (value: React.SetStateAction<Product>) => void;
}

const ProductTagsSection: React.FC<ProductTagsSectionProps> = ({
  editing,
  removeTag,
  tagInput,
  setTagInput,
  addTag,
  setEditing,
}) => {
  return (
    <>
    {/* Tags de tipo — usadas no filtro inteligente da loja */}
    <div>
      <label className="text-sm font-semibold block mb-1">
        🏷️ Tags de tipo <span className="text-xs font-normal text-muted-foreground">(filtro inteligente da loja)</span>
      </label>
      {(editing?.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(editing!.tags || []).map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold capitalize">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { addTag(); e.preventDefault(); } }}
          placeholder="Ex: shampoo, hidratante, filtro solar"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={!tagInput.trim()}
          className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-sm font-semibold disabled:opacity-40"
        >
          + Adicionar
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">Separe por vírgula. Ex: <em>shampoo · hidratante · filtro solar · protetor labial</em></p>
    </div>

    {/* Lançamento + Quantidade vendida */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
        <label className="text-sm font-semibold block mb-2">🆕 Lançamento</label>
        <button
          type="button"
          onClick={() => setEditing({ ...editing!, isNew: !editing!.isNew })}
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold w-full transition-colors ${
            editing?.isNew
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300'
              : 'bg-card text-muted-foreground border-border'
          }`}
        >
          <span>{editing?.isNew ? '✅ É lançamento' : 'Produto comum'}</span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${editing?.isNew ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-[left] ${editing?.isNew ? 'left-4' : 'left-0.5'}`} />
          </span>
        </button>
        <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 mt-1.5">Aparece em destaque no filtro "Lançamento".</p>
      </div>

      <div className="bg-secondary/40 border border-border rounded-lg p-3">
        <label className="text-sm font-semibold block mb-1">📊 Qtd. vendida</label>
        <input
          type="number"
          value={editing?.salesCount ?? 0}
          readOnly
          disabled
          className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/60 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">Somente leitura — incrementado automaticamente a cada pedido confirmado.</p>
      </div>

      <div className="bg-secondary/40 border border-border rounded-lg p-3">
        <label className="text-sm font-semibold block mb-1">⭐ Avaliação (1–5)</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={editing?.rating ?? ''}
          onChange={e => {
            const raw = e.target.value;
            const n = raw === '' ? undefined : Math.min(5, Math.max(0, Number(raw)));
            setEditing({ ...editing!, rating: n });
          }}
          placeholder="Ex: 4.8"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">Deixe vazio para não mostrar estrelas na loja.</p>
      </div>
    </div>

    </>
  );
};

export default ProductTagsSection;
