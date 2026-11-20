import React from 'react';
import { Product } from '@/types';

interface ProductDescriptionSectionProps {
  editing: Product;
  setEditing: (value: React.SetStateAction<Product>) => void;
}

const ProductDescriptionSection: React.FC<ProductDescriptionSectionProps> = ({
  editing,
  setEditing,
}) => {
  return (
    <>
    {/* Descrição */}
    <div>
      <label className="text-sm font-semibold block mb-1">Descrição</label>
      <textarea
        value={editing.description}
        onChange={(e) => setEditing({ ...editing, description: e.target.value })}
        rows={4}
        placeholder="Descreva o produto..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-y"
      />
    </div>

    </>
  );
};

export default ProductDescriptionSection;
