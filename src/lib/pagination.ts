export const PAGE_SIZE = 20;

export function parsePage(page?: string) {
  const n = Number(page);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
