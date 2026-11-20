import React from 'react';
import { Label } from '@/components/ui/label';
import { CountryType } from '@/context/LanguageContext';
import { WORLD_COUNTRIES } from '@/data/worldCountries';
import { Input } from '@/components/ui/input';
import { japanPrefectures } from '@/data/japanPrefectures';
import { usStates } from '@/data/usStates';
import { prefectures } from '@/data/prefectures';
import { europePrefectures } from '@/data/europePrefectures';

interface CheckoutShippingAddressProps {
  formData: { name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; };
  setSelectedCountry: (country: CountryType) => void;
  setFormData: (value: React.SetStateAction<{ name: string; email: string; phone: string; cpf: string; postalCode: string; prefecture: string; city: string; address: string; building: string; country: string; }>) => void;
  handlePostalCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors: { [x: string]: string; };
}

const CheckoutShippingAddress: React.FC<CheckoutShippingAddressProps> = ({
  formData,
  setSelectedCountry,
  setFormData,
  handlePostalCodeChange,
  handleInputChange,
  errors,
}) => {
  return (
    <>
    {/* Shipping Address */}
    <div className="space-y-4 pt-4 border-t border-gray-100">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
        Endereço de Entrega
      </h3>
                    
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="country" className="font-semibold">
            País de Destino *
          </Label>
          <select
            id="country"
            name="country"
            value={formData.country}
            onChange={(e) => {
              const val = e.target.value as CountryType;
              setSelectedCountry(val);
              setFormData(prev => ({
                ...prev,
                country: val,
                prefecture: '',
                postalCode: '',
                city: '',
                address: '',
                building: '',
              }));
            }}
            required
            className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition font-medium text-sm"
          >
            {WORLD_COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}{c.name === 'Japão' ? ' (Envio Local)' : ' (Envio Internacional)'}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="postalCode" className="font-semibold">
            {formData.country === 'Japão' ? 'Código Postal (ZIP) *' : formData.country === 'Estados Unidos' ? 'ZIP Code *' : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) ? 'Código Postal *' : 'CEP *'}
          </Label>
          <Input
            id="postalCode"
            name="postalCode"
            type="text"
            placeholder={formData.country === 'Japão' ? '123-4567' : formData.country === 'Portugal' ? '0000-000' : ['França', 'Itália', 'Espanha', 'Estados Unidos'].includes(formData.country) ? '00000' : '00000-000'}
            value={formData.postalCode}
            onChange={handlePostalCodeChange}
            required
          />
          <p className="text-[10px] text-gray-400">
            {formData.country === 'Japão'
              ? 'Preenche o endereço japonês automaticamente (7 dígitos).'
              : formData.country === 'Portugal'
              ? 'Formato XXXX-XXX (ex: 2910-112) — preenche cidade automaticamente.'
              : formData.country === 'Estados Unidos'
              ? 'Enter ZIP code (5 digits) — city and state auto-filled.'
              : ['França', 'Itália', 'Espanha'].includes(formData.country)
              ? 'Formato XXXXX (5 dígitos) — preenche cidade automaticamente.'
              : 'Preenche o endereço brasileiro automaticamente (8 dígitos).'}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prefecture" className="font-semibold">
            {formData.country === 'Japão' ? 'Província *' : formData.country === 'Estados Unidos' ? 'State *' : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) ? 'Região / Distrito *' : formData.country === 'Brasil' ? 'Estado (UF) *' : 'State / Region *'}
          </Label>
          {(() => {
            // Países com lista pronta usam select; os demais usam texto livre
            const stateList =
              formData.country === 'Japão' ? japanPrefectures
              : formData.country === 'Estados Unidos' ? usStates
              : formData.country === 'Brasil' ? prefectures
              : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country)
                ? (europePrefectures[formData.country] || [])
                : null;
            if (!stateList) {
              // Texto livre (preenchido automaticamente pelo CEP quando disponível)
              return (
                <Input
                  id="prefecture"
                  name="prefecture"
                  type="text"
                  placeholder="State / Region"
                  value={formData.prefecture}
                  onChange={handleInputChange}
                  required
                />
              );
            }
            return (
              <select
                id="prefecture"
                name="prefecture"
                value={formData.prefecture}
                onChange={handleInputChange}
                required
                className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition font-medium text-sm"
              >
                <option value="">
                  {formData.country === 'Japão' ? 'Escolha a Província...'
                    : formData.country === 'Estados Unidos' ? 'Select your State...'
                    : ['Portugal', 'França', 'Itália', 'Espanha'].includes(formData.country) ? 'Escolha a Região/Distrito...'
                    : 'Escolha seu Estado...'}
                </option>
                {stateList.map((pref) => (
                  <option key={pref.name} value={pref.name}>
                    {pref.nameJa || pref.name} ({pref.name})
                  </option>
                ))}
              </select>
            );
          })()}
        </div>

        <div className="space-y-2">
          <Label htmlFor="city" className="font-semibold">
            Cidade *
          </Label>
          <Input
            id="city"
            name="city"
            type="text"
            placeholder="Ex: São Paulo"
            value={formData.city}
            onChange={handleInputChange}
            aria-invalid={!!errors.city}
            className={errors.city ? 'border-destructive' : ''}
            required
          />
          {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address" className="font-semibold">
          Rua e Número *
        </Label>
        <Input
          id="address"
          name="address"
          type="text"
          placeholder="Ex: Avenida Paulista, 1000"
          value={formData.address}
          onChange={handleInputChange}
          aria-invalid={!!errors.address}
          className={errors.address ? 'border-destructive' : ''}
          required
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="building" className="font-semibold">
          Complemento / Bloco / Apto (Opcional)
        </Label>
        <Input
          id="building"
          name="building"
          type="text"
          placeholder="Ex: Bloco B, Apto 42"
          value={formData.building}
          onChange={handleInputChange}
        />
      </div>
    </div>

    </>
  );
};

export default CheckoutShippingAddress;
