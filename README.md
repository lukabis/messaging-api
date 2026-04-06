# API

## Migrations

Migrations are managed with [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview).

### Creating a migration

After modifying the schema in `src/schema.ts`, generate a migration file:

```bash
npm run db:generate
# or
npx drizzle-kit generate
```

This compares the current schema against the last snapshot and creates a new `.sql` file in `migrations/`.

### Running migrations

Apply pending migrations to the database:

```bash
npx drizzle-kit migrate
```

