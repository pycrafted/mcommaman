import { ORDER_STATUS_LABELS, type OrderStatus } from "./orders-context";

/* Les mêmes teintes que les pastilles de statut du back-office
   (`components/admin.tsx`) : une commande garde sa couleur des deux côtés. */
const TEINTES: Record<OrderStatus, string> = {
  recue: "bg-gold-soft text-[#8a6a12]",
  preparation: "bg-accent-soft text-accent-deep",
  expediee: "bg-[#eef3fd] text-[#33538f]",
  livree: "bg-[#eaf6ef] text-[#2e7d52]",
  annulee: "bg-stone text-[#5d5157]",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${TEINTES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
