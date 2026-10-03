export const ADMIN_PAGE_SIZE = 20;

export function AdminPagination({
  total, page, pageSize = ADMIN_PAGE_SIZE, onPageChange,
}: { total: number; page: number; pageSize?: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="admin-pagination">
      <span className="text-caption">{from}–{to} sur {total}</span>
      <button type="button" className="btn btn-secondary" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>Précédent</button>
      <span className="mono" style={{ fontSize: "0.85rem" }}>{page + 1} / {pages}</span>
      <button type="button" className="btn btn-secondary" disabled={page + 1 >= pages} onClick={() => onPageChange(page + 1)}>Suivant</button>
    </div>
  );
}
