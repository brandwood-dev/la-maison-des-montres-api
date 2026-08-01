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
});

export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
