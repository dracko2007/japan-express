// Nomes legíveis para país, estado e aparelho nas estatísticas de visitas.
export const DEVICE_LABEL: Record<string, string> = { mobile: 'Celular', desktop: 'Computador', tablet: 'Tablet', outro: 'Não identificado' };

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['pt-BR'], { type: 'region' })
  : null;

/** "BR" → "Brasil" (nomes do navegador, sem tabela para manter). */
export function countryLabel(code: string): string {
  try { return regionNames?.of(code) || code; } catch { return code; }
}

/** "BR" → bandeira. */
export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/** "BR-SP" → "Brasil · SP". */
export function regionLabel(key: string): string {
  const [country, ...rest] = key.split('-');
  return `${countryLabel(country)} · ${rest.join('-')}`;
}
