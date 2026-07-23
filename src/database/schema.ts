import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const appSchema = pgSchema('app');

export const adminRole = appSchema.enum('admin_role', [
  'super_admin',
  'admin',
  'operateur',
  'lecture_seule',
]);
export const adminStatus = appSchema.enum('admin_status', [
  'active',
  'pending',
  'disabled',
]);
export const attributeType = appSchema.enum('attribute_type', [
  'select',
  'multiselect',
  'color',
  'boolean',
  'text',
  'number',
]);
export const productStatus = appSchema.enum('product_status', [
  'draft',
  'published',
  'hidden',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull(),
};

export const adminUsers = appSchema.table(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    avatarUrl: text('avatar_url'),
    role: adminRole('role').notNull(),
    status: adminStatus('status').default('pending').notNull(),
    lastLoginAt: timestamp('last_login_at', {
      withTimezone: true,
      mode: 'date',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('admin_users_email_unique').on(sql`lower(${table.email})`),
    index('admin_users_role_idx').on(table.role),
    index('admin_users_status_idx').on(table.status),
  ],
);

export const adminSessions = appSchema.table(
  'admin_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'date',
    }),
    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('admin_sessions_token_hash_unique').on(table.tokenHash),
    index('admin_sessions_user_idx').on(table.adminUserId),
    index('admin_sessions_expires_idx').on(table.expiresAt),
  ],
);

export const brands = appSchema.table(
  'brands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    logoUrl: text('logo_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 500 }),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('brands_name_unique').on(sql`lower(${table.name})`),
    uniqueIndex('brands_slug_unique').on(table.slug),
    index('brands_active_idx').on(table.active),
  ],
);

export const categories = appSchema.table(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 500 }),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('categories_slug_unique').on(table.slug),
    index('categories_parent_idx').on(table.parentId),
    index('categories_active_order_idx').on(table.active, table.sortOrder),
    check('categories_not_self_parent', sql`${table.parentId} <> ${table.id}`),
  ],
);

export const attributes = appSchema.table(
  'attributes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    type: attributeType('type').notNull(),
    filterable: boolean('filterable').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('attributes_slug_unique').on(table.slug),
    index('attributes_active_order_idx').on(table.active, table.sortOrder),
  ],
);

export const attributeValues = appSchema.table(
  'attribute_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    swatch: varchar('swatch', { length: 32 }),
    imageUrl: text('image_url'),
    sortOrder: integer('sort_order').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('attribute_values_attribute_slug_unique').on(
      table.attributeId,
      table.slug,
    ),
    uniqueIndex('attribute_values_attribute_id_id_unique').on(
      table.attributeId,
      table.id,
    ),
    index('attribute_values_attribute_order_idx').on(
      table.attributeId,
      table.sortOrder,
    ),
  ],
);

export const products = appSchema.table(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 240 }).notNull(),
    reference: varchar('reference', { length: 120 }).notNull(),
    description: text('description').notNull(),
    price: integer('price').notNull(),
    oldPrice: integer('old_price'),
    status: productStatus('status').default('draft').notNull(),
    seoSlug: varchar('seo_slug', { length: 240 }).notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 500 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('products_reference_unique').on(sql`lower(${table.reference})`),
    uniqueIndex('products_seo_slug_unique').on(table.seoSlug),
    index('products_brand_idx').on(table.brandId),
    index('products_status_created_idx').on(table.status, table.createdAt),
    check('products_price_nonnegative', sql`${table.price} >= 0`),
    check(
      'products_old_price_nonnegative',
      sql`${table.oldPrice} is null or ${table.oldPrice} >= 0`,
    ),
  ],
);

export const productCategories = appSchema.table(
  'product_categories',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index('product_categories_category_idx').on(table.categoryId),
  ],
);

export const productAttributeValues = appSchema.table(
  'product_attribute_values',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => attributes.id, { onDelete: 'restrict' }),
    valueId: uuid('value_id').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.productId, table.attributeId, table.valueId],
    }),
    foreignKey({
      columns: [table.attributeId, table.valueId],
      foreignColumns: [attributeValues.attributeId, attributeValues.id],
      name: 'product_attribute_values_attribute_value_fk',
    }).onDelete('restrict'),
    index('product_attribute_values_attribute_idx').on(table.attributeId),
    index('product_attribute_values_value_idx').on(table.valueId),
  ],
);

export const productImages = appSchema.table(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaProvider: varchar('media_provider', { length: 64 }),
    mediaKey: varchar('media_key', { length: 512 }),
    url: text('url').notNull(),
    alt: varchar('alt', { length: 255 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('product_images_product_order_idx').on(
      table.productId,
      table.sortOrder,
    ),
  ],
);

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type AttributeRow = typeof attributes.$inferSelect;
export type AttributeValueRow = typeof attributeValues.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
