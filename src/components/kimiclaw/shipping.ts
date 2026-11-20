import type { Product } from '@/types';
import type { ShippingOption } from '@/components/kimiclaw/types';
import { WEIGHT_BY_CATEGORY, DEFAULT_WEIGHT } from '@/components/kimiclaw/constants';
import { normalizeText } from '@/components/kimiclaw/textSearch';
import { packedWeightG, productPackedWeightG } from '../../../shared/weight.js';
import { getELightRate, getAirParcelRate, getEmsRate, countryToZone } from '@/utils/japanPostRates';
import { convertYen as fxConvert } from '@/services/fxService';

// Frete REAL por país e peso — mesma tabela do Japan Post usada no Checkout,
// no feed do Google e no orçamento (getELightRate/getAirParcelRate/getEmsRate).
// Antes esta função inventava fórmula linear (base + R$/kg) com nomes de
// transportadora que não existem no sistema real ("PAC", "Prioritário") — dava
// até 5,6x o valor real do frete. Japão doméstico retorna [] de propósito: o
// preço real depende da província exata de entrega (zona 1-4 de Hiroshima) e
// essa informação não é coletada aqui — o chamador orienta a usar a calculadora
// real em vez de mostrar um valor chutado.
export const calculateShipping = (country: string, weightKg: number): ShippingOption[] => {
  const normalizedCountry = normalizeText(country);

  // Detect country from aliases. EUA primeiro: "estados unidos" contém "es"
  // (viraria Espanha) e "united" contém "it" (viraria Itália).
  let detectedCountry = country;
  if (normalizedCountry.includes('estados unidos') || normalizedCountry.includes('united states') || /\b(eua|usa|us)\b/.test(normalizedCountry)) detectedCountry = 'Estados Unidos';
  else if (normalizedCountry.includes('brasil') || normalizedCountry.includes('brazil') || normalizedCountry.includes('br')) detectedCountry = 'Brasil';
  else if (normalizedCountry.includes('japao') || normalizedCountry.includes('japan') || normalizedCountry.includes('ja')) detectedCountry = 'Japão';
  else if (normalizedCountry.includes('portugal') || normalizedCountry.includes('pt')) detectedCountry = 'Portugal';
  else if (normalizedCountry.includes('franca') || normalizedCountry.includes('france') || normalizedCountry.includes('fr')) detectedCountry = 'França';
  else if (normalizedCountry.includes('italia') || normalizedCountry.includes('italy') || normalizedCountry.includes('it')) detectedCountry = 'Itália';
  else if (normalizedCountry.includes('espanha') || normalizedCountry.includes('spain') || normalizedCountry.includes('es')) detectedCountry = 'Espanha';

  if (detectedCountry === 'Japão') return [];

  const zone = countryToZone(detectedCountry);
  const weightG = Math.max(100, Math.round(weightKg * 1000));

  // EUA: desde 15/10/2026 só sai com imposto pré-pago (DDP), e o único
  // serviço com DDP para loja é o EMS — mesma regra do checkout
  // (`src/utils/shippingQuote.ts`). Valor em dólar.
  if (detectedCountry === 'Estados Unidos') {
    const usEmsYen = getEmsRate(weightG, zone);
    return usEmsYen ? [{
      carrier: 'Japan Post EMS (DDP — imposto pré-pago, já no total)',
      basePrice: Math.round(fxConvert(usEmsYen, 'USD')),
      ratePerKg: 0,
      currency: 'USD',
      daysEstimate: '10-12',
    }] : [];
  }

  const currency: 'BRL' | 'EUR' = ['Portugal', 'França', 'Itália', 'Espanha'].includes(detectedCountry) ? 'EUR' : 'BRL';
  const daysByZone: Record<number, { light: string; air: string; ems: string }> = {
    1: { light: '6-10', air: '4-7', ems: '2-4' },
    2: { light: '7-12', air: '5-9', ems: '3-5' },
    3: { light: '7-14', air: '6-10', ems: '4-7' },
    4: { light: '7-14', air: '6-10', ems: '3-6' },
    5: { light: '20-40', air: '10-15', ems: '18' },
  };
  const zd = daysByZone[zone] || daysByZone[5];
  const options: ShippingOption[] = [];

  if (weightG <= 2000) {
    const eLightYen = getELightRate(weightG, zone);
    if (eLightYen) {
      options.push({
        carrier: 'Japan Post Air Packet (国際エアパケット)',
        basePrice: Math.round(fxConvert(eLightYen, currency)),
        ratePerKg: 0,
        currency,
        daysEstimate: zd.light,
      });
    }
  } else {
    const airYen = getAirParcelRate(weightG, zone);
    if (airYen) {
      options.push({
        carrier: 'Japan Post Kozutsumi Air (国際小包航空便)',
        basePrice: Math.round(fxConvert(airYen, currency)),
        ratePerKg: 0,
        currency,
        daysEstimate: zd.air,
      });
    }
  }

  const emsYen = getEmsRate(weightG, zone);
  if (emsYen) {
    options.push({
      carrier: 'Japan Post EMS · via DHL',
      basePrice: Math.round(fxConvert(emsYen, currency)),
      ratePerKg: 0,
      currency,
      daysEstimate: zd.ems,
    });
  }

  return options;
};

// Calcula o peso total de um produto para uma variante/tamanho específico
export const getProductWeight = (product: Product, size: string): number => {
  if (product.weightGrams) return productPackedWeightG(product);
  const rawWeight = WEIGHT_BY_CATEGORY[product.category] || DEFAULT_WEIGHT;
  return packedWeightG(size === 'large' ? rawWeight.large : rawWeight.small);
};
