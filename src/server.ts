import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
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
  const userInfo = await userInfoRes.json();

  if (!userInfo.sub) {
    return res.status(401).json({ error: "Unable to fetch user info" });
  }
  
  const { sub, email, given_name, family_name } = userInfo;

  let [user] = await db
    .insert(users)
    .values({ sub, email, firstName: given_name ?? null, lastName: family_name ?? null })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    [user] = await db.select().from(users).where(eq(users.sub, sub));
  }

  res.status(200).json(user);
});

app.patch("/api/user", checkJwt, async (req: Request, res: Response) => {
  const { firstName, lastName, username, onboarded: rawOnboarded } = req.body;

  let onboarded: boolean | undefined;
  if (rawOnboarded !== undefined) {
    if (rawOnboarded === true || rawOnboarded === "true") onboarded = true;
    else if (rawOnboarded === false || rawOnboarded === "false") onboarded = false;
    else return res.status(400).json({ error: "onboarded must be a boolean" });
  }

  if (!firstName || !lastName || !username) {
    return res.status(400).json({ error: "First name, last name and username are required" });
  }
  if ([firstName, lastName, username].some((v) => v.length < 3)) {
    return res.status(400).json({ error: "Each field must be at least 3 characters" });
  }

  const sub = req.auth!.payload.sub!;

  try {
    const [user] = await db
      .update(users)
      .set({ firstName, lastName, username, ...(onboarded !== undefined && { onboarded }) })
      .where(eq(users.sub, sub))
      .returning();

    res.status(200).json(user);
  } catch (err: any) {
    if (err.constraint === "users_username_unique") {
      return res.status(409).json({ error: "Username already taken" });
    }
    throw err;
  }
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
