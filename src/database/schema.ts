import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
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

export type AdminNotificationPreferences = {
  newOrder: boolean;
  toConfirm: boolean;
  lowStock: boolean;
  reviews: boolean;
  emailDigest: boolean;
};

export const DEFAULT_ADMIN_NOTIFICATION_PREFERENCES: AdminNotificationPreferences =
  {
    newOrder: true,
    toConfirm: true,
    lowStock: true,
    reviews: false,
    emailDigest: true,
  };
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
export const orderStatus = appSchema.enum('order_status', [
  'new',
  'to_confirm',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]);
export const paymentMethod = appSchema.enum('payment_method', ['cod']);
export const paymentStatus = appSchema.enum('payment_status', [
  'pending',
  'paid',
  'refunded',
  'failed',
]);
export const emailDeliveryStatus = appSchema.enum('email_delivery_status', [
  'pending',
  'sent',
  'failed',
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
    notificationPreferences: jsonb('notification_preferences')
      .$type<AdminNotificationPreferences>()
      .default(DEFAULT_ADMIN_NOTIFICATION_PREFERENCES)
      .notNull(),
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

/**
 * Per-admin read markers for the derived notification feed. Notifications
 * are built from orders/products, while this table keeps only the user's
 * acknowledgement so it remains stable across navigation and devices.
 */
export const adminNotificationReads = appSchema.table(
  'admin_notification_reads',
  {
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    notificationKey: varchar('notification_key', { length: 255 }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.adminUserId, table.notificationKey] }),
    index('admin_notification_reads_admin_idx').on(table.adminUserId),
    index('admin_notification_reads_read_at_idx').on(table.readAt),
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

/**
 * Invitations are intentionally separate from admin_users. A pending invite
 * never receives a password hash or an active session until it is accepted.
 */
export const adminInvitations = appSchema.table(
  'admin_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    role: adminRole('role').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdBy: uuid('created_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('admin_invitations_token_hash_unique').on(table.tokenHash),
    index('admin_invitations_email_idx').on(sql`lower(${table.email})`),
    index('admin_invitations_expires_idx').on(table.expiresAt),
    index('admin_invitations_creator_idx').on(table.createdBy),
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
    slugCustom: boolean('slug_custom').default(false).notNull(),
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

export const heroSlides = appSchema.table(
  'hero_slides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tagline: varchar('tagline', { length: 80 }),
    title: varchar('title', { length: 160 }).notNull(),
    subtitle: varchar('subtitle', { length: 300 }),
    ctaPrimaryLabel: varchar('cta_primary_label', { length: 80 }).notNull(),
    ctaPrimaryHref: varchar('cta_primary_href', { length: 500 }).notNull(),
    ctaSecondaryLabel: varchar('cta_secondary_label', { length: 80 }).notNull(),
    ctaSecondaryHref: varchar('cta_secondary_href', { length: 500 }).notNull(),
    imageUrl: text('image_url').notNull(),
    imageKey: varchar('image_key', { length: 512 }),
    imageAlt: varchar('image_alt', { length: 255 }),
    sortOrder: integer('sort_order').default(1).notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    index('hero_slides_active_order_idx').on(table.active, table.sortOrder),
    index('hero_slides_updated_idx').on(table.updatedAt),
    check('hero_slides_order_positive', sql`${table.sortOrder} >= 1`),
  ],
);

export const promoBannerMessages = appSchema.table(
  'promo_banner_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    message: varchar('message', { length: 160 }).notNull(),
    sortOrder: integer('sort_order').default(1).notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('promo_banner_messages_message_unique').on(
      sql`lower(${table.message})`,
    ),
    index('promo_banner_messages_active_order_idx').on(
      table.active,
      table.sortOrder,
    ),
    index('promo_banner_messages_updated_idx').on(table.updatedAt),
    check('promo_banner_messages_order_positive', sql`${table.sortOrder} >= 1`),
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
    shortDescription: text('short_description'),
    price: integer('price').notNull(),
    oldPrice: integer('old_price'),
    stock: integer('stock').default(0).notNull(),
    isBestSeller: boolean('is_best_seller').default(false).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    promotionActive: boolean('promotion_active').default(false).notNull(),
    promotionStartsAt: timestamp('promotion_starts_at', {
      withTimezone: true,
      mode: 'date',
    }),
    promotionEndsAt: timestamp('promotion_ends_at', {
      withTimezone: true,
      mode: 'date',
    }),
    status: productStatus('status').default('draft').notNull(),
    seoSlug: varchar('seo_slug', { length: 240 }).notNull(),
    seoTitle: varchar('seo_title', { length: 255 }),
    seoDescription: varchar('seo_description', { length: 500 }),
    seoSlugCustom: boolean('seo_slug_custom').default(false).notNull(),
    seoTitleCustom: boolean('seo_title_custom').default(false).notNull(),
    seoDescriptionCustom: boolean('seo_description_custom')
      .default(false)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('products_reference_unique').on(sql`lower(${table.reference})`),
    uniqueIndex('products_seo_slug_unique').on(table.seoSlug),
    index('products_brand_idx').on(table.brandId),
    index('products_status_created_idx').on(table.status, table.createdAt),
    index('products_best_seller_idx').on(
      table.status,
      table.isBestSeller,
      table.createdAt,
    ),
    index('products_featured_idx').on(
      table.status,
      table.isFeatured,
      table.createdAt,
    ),
    check('products_price_nonnegative', sql`${table.price} >= 0`),
    check('products_stock_nonnegative', sql`${table.stock} >= 0`),
    check(
      'products_old_price_nonnegative',
      sql`${table.oldPrice} is null or ${table.oldPrice} >= 0`,
    ),
    check(
      'products_promotion_prices_valid',
      sql`not ${table.promotionActive} or (
        ${table.oldPrice} is not null
        and ${table.oldPrice} > ${table.price}
        and ${table.promotionEndsAt} is not null
      )`,
    ),
    check(
      'products_promotion_dates_valid',
      sql`${table.promotionStartsAt} is null
        or ${table.promotionEndsAt} is null
        or ${table.promotionStartsAt} < ${table.promotionEndsAt}`,
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
    index('product_attribute_values_attribute_value_idx').on(
      table.attributeId,
      table.valueId,
    ),
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

/**
 * Curated testimonials managed by the back-office and displayed on the
 * storefront. Customer-submitted reviews remain a separate future module.
 */
export const testimonials = appSchema.table(
  'testimonials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    message: varchar('message', { length: 1000 }).notNull(),
    rating: integer('rating').notNull(),
    governorate: varchar('governorate', { length: 120 }).notNull(),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productTitleSnapshot: varchar('product_title_snapshot', { length: 240 }),
    published: boolean('published').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index('testimonials_published_order_idx').on(
      table.published,
      table.sortOrder,
      table.createdAt,
    ),
    index('testimonials_product_idx').on(table.productId),
    check('testimonials_rating_range', sql`${table.rating} between 1 and 5`),
    check('testimonials_sort_order_nonnegative', sql`${table.sortOrder} >= 0`),
  ],
);

/**
 * Public storefront configuration managed by the back-office.
 *
 * Team and delivery configuration intentionally remain in their existing
 * modules; this table only stores identity, support and global SEO values.
 */
export const storeSettings = appSchema.table('store_settings', {
  id: varchar('id', { length: 32 }).default('default').primaryKey(),
  identityName: varchar('identity_name', { length: 160 }).notNull(),
  identityTagline: varchar('identity_tagline', { length: 200 }),
  identityLogoUrl: text('identity_logo_url'),
  identityLogoLightUrl: text('identity_logo_light_url'),
  shippingFeeMillimes: integer('shipping_fee_millimes').default(8000).notNull(),
  freeShippingEnabled: boolean('free_shipping_enabled').default(false).notNull(),
  freeShippingThresholdMillimes: integer('free_shipping_threshold_millimes'),
  currency: varchar('currency', { length: 3 }).default('TND').notNull(),
  supportEmail: varchar('support_email', { length: 320 }),
  supportPhone: varchar('support_phone', { length: 32 }),
  supportWhatsapp: varchar('support_whatsapp', { length: 32 }),
  supportAddress: text('support_address'),
  seoDefaultTitle: varchar('seo_default_title', { length: 255 }).notNull(),
  seoDefaultDescription: varchar('seo_default_description', {
    length: 500,
  }).notNull(),
  ...timestamps,
});

export const orders = appSchema.table(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reference: varchar('reference', { length: 40 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    customerName: varchar('customer_name', { length: 200 }).notNull(),
    customerEmail: varchar('customer_email', { length: 320 }),
    customerPhone: varchar('customer_phone', { length: 32 }).notNull(),
    // Canonical Tunisian phone used for customer deduplication in analytics.
    // Nullable keeps historical orders with invalid/missing formats countable
    // as orders while excluding them from the distinct-customer KPI.
    customerPhoneNormalized: varchar('customer_phone_normalized', {
      length: 16,
    }),
    governorate: varchar('governorate', { length: 120 }).notNull(),
    city: varchar('city', { length: 160 }).notNull(),
    address: text('address').notNull(),
    postalCode: varchar('postal_code', { length: 16 }),
    notes: varchar('notes', { length: 500 }),
    subtotal: integer('subtotal').notNull(),
    shippingFee: integer('shipping_fee').notNull(),
    total: integer('total').notNull(),
    currency: varchar('currency', { length: 3 }).default('TND').notNull(),
    status: orderStatus('status').default('new').notNull(),
    paymentMethod: paymentMethod('payment_method').default('cod').notNull(),
    paymentStatus: paymentStatus('payment_status').default('pending').notNull(),
    deliveredAt: timestamp('delivered_at', {
      withTimezone: true,
      mode: 'date',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('orders_reference_unique').on(table.reference),
    uniqueIndex('orders_idempotency_key_unique').on(table.idempotencyKey),
    index('orders_status_created_idx').on(table.status, table.createdAt),
    index('orders_status_delivered_idx').on(table.status, table.deliveredAt),
    index('orders_phone_idx').on(table.customerPhone),
    index('orders_phone_normalized_idx').on(table.customerPhoneNormalized),
    check('orders_subtotal_nonnegative', sql`${table.subtotal} >= 0`),
    check('orders_shipping_nonnegative', sql`${table.shippingFee} >= 0`),
    check('orders_total_nonnegative', sql`${table.total} >= 0`),
  ],
);

export const orderItems = appSchema.table(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 240 }).notNull(),
    reference: varchar('reference', { length: 120 }).notNull(),
    imageUrl: text('image_url'),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (table) => [
    index('order_items_order_idx').on(table.orderId),
    index('order_items_product_idx').on(table.productId),
    check('order_items_quantity_positive', sql`${table.quantity} >= 1`),
    check('order_items_unit_price_nonnegative', sql`${table.unitPrice} >= 0`),
    check('order_items_line_total_nonnegative', sql`${table.lineTotal} >= 0`),
  ],
);

/**
 * Immutable audit trail for admin order status changes. The actor snapshot
 * keeps the history readable even if an admin account is later removed.
 */
export const orderStatusHistory = appSchema.table(
  'order_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    changedBy: uuid('changed_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    changedByName: varchar('changed_by_name', { length: 160 }).notNull(),
    changedByEmail: varchar('changed_by_email', { length: 320 }),
    action: varchar('action', { length: 240 }).notNull(),
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('order_status_history_order_created_idx').on(
      table.orderId,
      table.createdAt,
    ),
    index('order_status_history_actor_idx').on(table.changedBy),
  ],
);

/**
 * Idempotent delivery ledger for operational order emails. It is deliberately
 * kept in the private app schema and never exposed through the browser API.
 */
export const orderNotificationDeliveries = appSchema.table(
  'order_notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    recipientEmail: varchar('recipient_email', { length: 320 }).notNull(),
    status: emailDeliveryStatus('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastAttemptAt: timestamp('last_attempt_at', {
      withTimezone: true,
      mode: 'date',
    }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    lastError: varchar('last_error', { length: 500 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('order_notification_deliveries_order_recipient_unique').on(
      table.orderId,
      sql`lower(${table.recipientEmail})`,
    ),
    index('order_notification_deliveries_order_idx').on(table.orderId),
    index('order_notification_deliveries_status_idx').on(table.status),
  ],
);

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type AdminInvitationRow = typeof adminInvitations.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type HeroSlideRow = typeof heroSlides.$inferSelect;
export type PromoBannerMessageRow = typeof promoBannerMessages.$inferSelect;
export type AttributeRow = typeof attributes.$inferSelect;
export type AttributeValueRow = typeof attributeValues.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
export type TestimonialRow = typeof testimonials.$inferSelect;
export type StoreSettingsRow = typeof storeSettings.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
export type OrderNotificationDeliveryRow =
  typeof orderNotificationDeliveries.$inferSelect;
