import type Lenis from 'lenis';

// Instância ativa do Lenis. Fica num módulo próprio (e não em smoothScroll.tsx) para o
// componente SmoothScroll poder ser o único export daquele arquivo.
let activeLenis: Lenis | null = null;

/** Chamado só pelo SmoothScroll: registra a instância ao montar e limpa (null) ao desmontar. */
export const setActiveLenis = (lenis: Lenis | null): void => {
  activeLenis = lenis;
};

/**
 * Instância ativa do Lenis, para scroll programático que respeita o smooth
 * scroll (ex.: autoplay do CinematicHeroShelf). `null` quando o Lenis não
 * está rodando (prefers-reduced-motion).
 */
export const getLenis = (): Lenis | null => activeLenis;

/** Volta ao topo da página com scroll suave (respeita o Lenis quando ativo). */
export function scrollPageToTop(): void {
  const lenis = activeLenis;
  if (lenis) lenis.scrollTo(0);
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}
