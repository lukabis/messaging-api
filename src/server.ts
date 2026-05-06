import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";
import { app } from "./app.js";

await migrate(db, { migrationsFolder: "./migrations" });

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
