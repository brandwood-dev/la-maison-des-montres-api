import * as Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().uri().required(),
  }),
  DATABASE_DIRECT_URL: Joi.string().uri().optional(),
  SUPABASE_URL: Joi.string().uri().optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9._-]{1,62}$/)
    .default('product-media'),
  BREVO_API_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  BREVO_SENDER_EMAIL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().allow('').optional(),
  }),
  BREVO_SENDER_NAME: Joi.string().max(120).default('La Maison des Montres'),
  ADMIN_PUBLIC_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .default('http://localhost:4173'),
  }),
  PUBLIC_SITE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .default('https://lamaisondesmontres.com'),
    otherwise: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .default('http://localhost:4173'),
  }),
  CLOUDFLARE_ACCOUNT_ID: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .pattern(/^[a-f0-9]{32}$/i)
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CLOUDFLARE_ACCESS_GROUP_ID: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .guid({ version: ['uuidv4', 'uuidv5'] })
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CLOUDFLARE_API_TOKEN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  ORDER_NOTIFICATION_EMAIL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().allow('').optional(),
  }),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  JWT_ACCESS_SECRET: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().min(32).default('test-access-secret-not-for-production'),
    otherwise: Joi.string().min(32).required(),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string()
      .min(32)
      .default('test-refresh-secret-not-for-production'),
    otherwise: Joi.string().min(32).required(),
  }),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().min(3600).default(604800),
  COOKIE_SECURE: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(true).required(),
    otherwise: Joi.boolean().default(false),
  }),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  DEV_SEED_ENABLED: Joi.boolean().default(false),
  DEV_SEED_SUPER_ADMIN_EMAIL: Joi.string().email().optional(),
  DEV_SEED_SUPER_ADMIN_PASSWORD: Joi.string().min(12).optional(),
  COD_SHIPPING_FEE_MILLIMES: Joi.number().integer().min(0).default(8_000),
  COD_FREE_SHIPPING_THRESHOLD_MILLIMES: Joi.number()
    .integer()
    .min(0)
    .default(500_000),
});

export function parseOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.map((origin) => {
    if (origin === '*') {
      throw new Error(
        'CORS_ORIGINS must contain explicit origins when credentials are enabled',
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    return `${parsed.protocol}//${parsed.host}`;
  });
}
