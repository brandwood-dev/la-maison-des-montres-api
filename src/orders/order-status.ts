export const ORDER_STATUSES = [
  'new',
  'to_confirm',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Admin status changes are intentionally reversible: an operator may correct
 * a mistaken status without changing the order's financial snapshot.
 */
export function allowedOrderStatusTransitions(
  current: OrderStatus,
): OrderStatus[] {
  return ORDER_STATUSES.filter((status) => status !== current);
}
