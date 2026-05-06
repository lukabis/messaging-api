import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../db.js";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./migrations" });
});
