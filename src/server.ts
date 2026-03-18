import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { auth } from "express-oauth2-jwt-bearer";

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

app.get("/api/user", checkJwt, async (req: Request, res: Response) => {
  const token = req.headers.authorization!.split(" ")[1];
  const userInfoRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const userInfo = await userInfoRes.json();
  console.log("User data:", userInfo);
  res.status(200).json({ message: "Protected resource accessed successfully" });
});

app.use((err: Error & { code?: string }, req: Request, res: Response, next: NextFunction) => {
  if (err.code === "invalid_token") {
    return res.status(401).json({ error: "Invalid or missing token" });
  }
  next(err);
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
