import "dotenv/config";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";
import { app } from "./app.js";
import { setupWs } from "./ws.js";

await migrate(db, { migrationsFolder: "./migrations" });

const port = process.env.PORT ?? 3001;
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });
setupWs(wss);

httpServer.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
