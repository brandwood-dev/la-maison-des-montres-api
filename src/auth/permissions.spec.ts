import { ROLE_PERMISSIONS } from './permissions';

describe('ROLE_PERMISSIONS', () => {
  it('keeps team management exclusive to super_admin', () => {
    expect(ROLE_PERMISSIONS.super_admin).toContain('team.manage');
    expect(ROLE_PERMISSIONS.admin).not.toContain('team.manage');
    expect(ROLE_PERMISSIONS.operateur).not.toContain('team.manage');
    expect(ROLE_PERMISSIONS.lecture_seule).not.toContain('team.manage');
  });

  it('prevents operators and read-only users from writing products', () => {
    expect(ROLE_PERMISSIONS.operateur).not.toContain('products.write');
    expect(ROLE_PERMISSIONS.lecture_seule).toEqual(
      expect.arrayContaining([
        'products.read',
        'orders.read',
        'customers.read',
        'notifications.read',
      ]),
    );
    expect(ROLE_PERMISSIONS.lecture_seule).not.toContain('products.write');
  });
});
