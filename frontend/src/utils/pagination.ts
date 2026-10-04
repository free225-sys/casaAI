/** Charge toutes les pages d'une liste paginée jusqu'au total annoncé par l'API (aucune troncature silencieuse). */
export async function allPages<T>(
  read: (params: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>,
  limit: number,
): Promise<T[]> {
  const items: T[] = [];
  let total = 1;
  while (items.length < total) {
    const page = await read({ limit, offset: items.length });
    total = page.total;
    if (page.items.length === 0 && items.length < total) throw new Error("Liste incomplète.");
    items.push(...page.items);
  }
  return items;
}
