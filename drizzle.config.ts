import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config — generates + applies SQL migrations against Neon.
 *
 *   npx drizzle-kit generate   # create SQL from schema changes
 *   npx drizzle-kit migrate    # apply pending migrations to DATABASE_URL
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
