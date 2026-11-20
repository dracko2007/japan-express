import React from 'react';
import { Link } from 'react-router-dom';
import { productEnglishName } from '@/utils/productName';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { convertYen as fxConvert } from '@/services/fxService';
import { effectiveYen } from '@/utils/pricing';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Message } from '@/components/kimiclaw/types';
import { Product } from '@/types';

interface KimiProductResultsProps {
  msg: Message;
  selectedCountry: string;
  addToCart: (product: Product, size: string, quantity?: number, variantLabel?: string) => void;
  language: "pt" | "en" | "ja";
  t: (key: string) => string;
}

const KimiProductResults: React.FC<KimiProductResultsProps> = ({
  msg,
  selectedCountry,
  addToCart,
  language,
  t,
}) => {
  return (
    <>
    {/* PRODUCT SEARCH RESULTS */}
    {msg.products && msg.products.length > 0 && (
      <div className="flex flex-col gap-2 mt-2">
        {msg.products.map((product) => (
          <div key={product.id} className="bg-muted/40 border border-border rounded-lg p-2.5 hover:bg-muted/60 transition-colors">
            <div className="flex gap-2 items-center">
              <Link to={`/produto/${product.id}`} className="group flex flex-1 min-w-0 items-center gap-2">
                <img src={product.image} alt={productEnglishName(product)} className="w-12 h-12 rounded object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{productEnglishName(product)}</p>
                  <p className="text-[10px] text-muted-foreground">{product.category}</p>
                  <p className="text-[11px] font-bold text-primary mt-1">
                    {formatPrice(fxConvert(effectiveYen(product, 'small'), getCurrencyByCountry(selectedCountry)), getCurrencyByCountry(selectedCountry))}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </Link>
              <button
                onClick={() => {
                  addToCart(product, 'small', 1);
                  toast.success(language === 'pt' ? `Adicionado: ${productEnglishName(product)}` : `Added: ${productEnglishName(product)}`);
                }}
                className="flex-shrink-0 bg-primary hover:bg-primary/95 text-white p-1.5 rounded-lg transition-colors"
                title={t('kimiclaw.search.add_to_cart')}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}

    </>
  );
};

export default KimiProductResults;
