// Cor do troféu por nível. Fica fora do componente para não recriar o objeto a
// cada render; as cores são fixas (metal), não seguem o tema.
export const TIER_TROPHY: Record<string, string> = {
  bronze: 'text-amber-700',
  prata: 'text-slate-200',
  ouro: 'text-yellow-300',
};
