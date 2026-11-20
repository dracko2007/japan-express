/** 86_399_000 -> "23:59:59". Nunca negativo; passa de 99 h sem quebrar. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
}
