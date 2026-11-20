import React from 'react';
import type { ReviewFormData } from '@/components/checkout/reviewTypes';
import { User } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface OrderReviewCustomerInfoProps {
  isJapan: boolean;
  formData: ReviewFormData;
}

const OrderReviewCustomerInfo: React.FC<OrderReviewCustomerInfoProps> = ({
  isJapan,
  formData,
}) => {
  return (
    <>
    {/* Customer & Customs Info */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-sans text-xl font-bold text-foreground">
          {isJapan ? 'Informações do Cliente' : 'Informações de Faturamento e Aduana'}
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <Label className="text-muted-foreground font-semibold">Nome Completo</Label>
          <p className="font-bold text-gray-800 text-base">{formData.name}</p>
        </div>

         {formData.country === 'Brasil' && (
           <div>
             <Label className="text-muted-foreground font-semibold">CPF (Desembaraço Aduaneiro)</Label>
             <p className="font-bold text-pink-600 text-base">{formData.cpf}</p>
           </div>
         )}

        <div>
          <Label className="text-muted-foreground font-semibold">Telefone</Label>
          <p className="font-medium text-gray-800">{formData.phone}</p>
        </div>

        <div>
          <Label className="text-muted-foreground font-semibold">Email de Contato</Label>
          <p className="font-medium text-gray-800">{formData.email}</p>
        </div>
      </div>
    </div>

    </>
  );
};

export default OrderReviewCustomerInfo;
