import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";
import { users } from "./schema.js";

await migrate(db, { migrationsFolder: "./migrations" });

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/user", checkJwt, async (req: Request, res: Response) => {
  const token = req.headers.authorization!.split(" ")[1];
  const userInfoRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { sub, email, given_name, family_name } = await userInfoRes.json();

  await db
    .insert(users)
    .values({ sub, email, firstName: given_name ?? null, lastName: family_name ?? null })
    .onConflictDoUpdate({
      target: users.sub,
      set: { email, firstName: given_name ?? null, lastName: family_name ?? null },
    });

  res.status(200).json({ message: "Protected resource accessed successfully" });
});

app.use((err: Error & { code?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err.code === "invalid_token") {
    return res.status(401).json({ error: "Invalid or missing token" });
  }
  next(err);
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
