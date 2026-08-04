export const adminRoles = [
  'super_admin',
  'admin',
  'operateur',
  'lecture_seule',
] as const;
export type AdminRole = (typeof adminRoles)[number];

export const permissions = [
  'dashboard.read',
  'team.manage',
  'products.read',
  'products.write',
  'categories.write',
  'attributes.write',
  'stock.write',
  'promotions.write',
  'orders.read',
  'orders.write',
  'orders.status',
  'customers.read',
  'customers.write',
  'content.write',
  'reviews.moderate',
  'notifications.read',
  'settings.write',
] as const;
export type Permission = (typeof permissions)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: permissions,
  admin: permissions.filter((permission) => permission !== 'team.manage'),
  operateur: [
    'dashboard.read',
    'products.read',
    'stock.write',
    'orders.read',
    'orders.write',
    'orders.status',
    'customers.read',
    'notifications.read',
  ],
  lecture_seule: [
    'dashboard.read',
    'products.read',
    'orders.read',
    'customers.read',
    'notifications.read',
  ],
};
