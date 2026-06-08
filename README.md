# Messaging API

![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

REST + WebSocket API for the [Chat App](https://github.com/lukabis/messaging-app) — handles Auth0 JWT validation, real-time messaging, friend relationships, and file uploads.

## Features

- JWT authentication via Auth0 (`express-oauth2-jwt-bearer`)
- Real-time messaging with WebSockets (`ws`)
- PostgreSQL database with Drizzle ORM
- File uploads with Multer
- Integration tests with Vitest + Supertest against a real PostgreSQL database

## Tech Stack

|           |                                         |
| --------- | --------------------------------------- |
| Runtime   | Node.js >=23.4.0                        |
| Framework | Express 4                               |
| Database  | PostgreSQL + Drizzle ORM                |
| Auth      | Auth0 JWT (`express-oauth2-jwt-bearer`) |
| Real-time | WebSockets (`ws`)                       |
| Testing   | Vitest + Supertest                      |

## Frontend

[lukabis/messaging-app](https://github.com/lukabis/messaging-app)

## License

[MIT](https://opensource.org/licenses/MIT)

---

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

## Testing

Tests use Vitest + Supertest against a real PostgreSQL test database.

### One-time setup

Create the test database:

```bash
docker exec api-db-1 psql -U postgres -c "CREATE DATABASE app_test"
```

### Running tests

```bash
npm test
```
