import React from 'react';
import type { ReviewFormData } from '@/components/checkout/reviewTypes';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface OrderReviewShippingAddressProps {
  formData: ReviewFormData;
  isJapan: boolean;
}

const OrderReviewShippingAddress: React.FC<OrderReviewShippingAddressProps> = ({
  formData,
  isJapan,
}) => {
  return (
    <>
    {/* Shipping Address */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-primary" />
        </div>
          <h2 className="font-sans text-xl font-bold text-foreground">
            Endereço de Entrega ({
              formData.country === 'Japão' ? 'Japão 🇯🇵' :
              formData.country === 'Brasil' ? 'Brasil 🇧🇷' :
              formData.country === 'Portugal' ? 'Portugal 🇵🇹' :
              formData.country === 'França' ? 'França 🇫🇷' :
              formData.country === 'Itália' ? 'Itália 🇮🇹' :
              formData.country === 'Espanha' ? 'Espanha 🇪🇸' :
              formData.country === 'Estados Unidos' ? 'Estados Unidos 🇺🇸' :
              formData.country
            })
          </h2>
      </div>
              
      <div className="space-y-3 text-sm">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-muted-foreground">Código Postal / CEP</Label>
            <p className="font-bold text-gray-800">〒 {formData.postalCode}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{isJapan ? 'Província' : 'Estado / UF'}</Label>
            <p className="font-medium text-gray-800">{formData.prefecture}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Cidade</Label>
            <p className="font-medium text-gray-800">{formData.city}</p>
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground">Rua e Número</Label>
          <p className="font-medium text-gray-800">{formData.address}</p>
        </div>
        {formData.building && (
          <div>
            <Label className="text-muted-foreground">Complemento / Edifício</Label>
            <p className="font-medium text-gray-800">{formData.building}</p>
          </div>
        )}
      </div>
    </div>

    </>
  );
};

export default OrderReviewShippingAddress;
