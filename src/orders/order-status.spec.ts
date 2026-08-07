import {
  allowedOrderStatusTransitions,
  type OrderStatus,
} from './order-status';

describe('order status transitions', () => {
  it('allows moving backward as well as forward', () => {
    const transitions = allowedOrderStatusTransitions('confirmed');

    expect(transitions).toContain('to_confirm');
    expect(transitions).toContain('new');
    expect(transitions).toContain('preparing');
    expect(transitions).not.toContain('confirmed');
  });

  it('allows every other official status, including terminal statuses', () => {
    const statuses: OrderStatus[] = [
      'new',
      'to_confirm',
      'confirmed',
      'preparing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ];

    for (const status of statuses) {
      expect(allowedOrderStatusTransitions(status)).toHaveLength(
        statuses.length - 1,
      );
    }
  });
});
