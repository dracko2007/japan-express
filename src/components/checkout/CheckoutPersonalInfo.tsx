import React from 'react';
import { Label } from '@/components/ui/label';
import { User, Phone, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CheckoutPersonalInfoProps {
  formData: { name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; };
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors: { [x: string]: string; };
  handleCpfChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const CheckoutPersonalInfo: React.FC<CheckoutPersonalInfoProps> = ({
  formData,
  handleInputChange,
  errors,
  handleCpfChange,
}) => {
  return (
    <>
    {/* Personal Information */}
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
        Informações Pessoais
      </h3>
                    
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2 font-semibold">
            <User className="w-4 h-4 text-gray-500" />
            Nome Completo *
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Ex: João Silva"
            value={formData.name}
            onChange={handleInputChange}
            aria-invalid={!!errors.name}
            className={errors.name ? 'border-destructive' : ''}
            required
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2 font-semibold">
            <Phone className="w-4 h-4 text-gray-500" />
            Telefone Celular *
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Ex: 090-1234-5678"
            value={formData.phone}
            onChange={handleInputChange}
            aria-invalid={!!errors.phone}
            className={errors.phone ? 'border-destructive' : ''}
            maxLength={13}
            required
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2 font-semibold">
            <Mail className="w-4 h-4 text-gray-500" />
            Email *
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="exemplo@email.com"
            value={formData.email}
            onChange={handleInputChange}
            aria-invalid={!!errors.email}
            className={errors.email ? 'border-destructive' : ''}
            required
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

      {formData.country === 'Brasil' && (
        <div className="space-y-2">
          <Label htmlFor="cpf" className="flex items-center gap-2 font-semibold">
            <User className="w-4 h-4 text-gray-500" />
            CPF (Obrigatório Aduana) *
          </Label>
          <Input
            id="cpf"
            name="cpf"
            type="text"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={handleCpfChange}
            aria-invalid={!!errors.cpf}
            className={errors.cpf ? 'border-destructive' : ''}
            required
          />
          {errors.cpf ? (
            <p className="text-xs text-destructive">{errors.cpf}</p>
          ) : (
            <p className="text-[10px] text-gray-400">
              Exigido pela Receita Federal para desembaraço de importação.
            </p>
          )}
        </div>
      )}
      </div>
    </div>

    </>
  );
};

export default CheckoutPersonalInfo;
