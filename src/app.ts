import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { userRouter } from "./routes/user.js";
import { friendsRouter } from "./routes/friends.js";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", userRouter);
app.use("/api", friendsRouter);

app.use((err: Error & { code?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err.code === "invalid_token") {
    return res.status(401).json({ error: "Invalid or missing token" });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "File too large. Max 5MB." });
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "Images only") return res.status(400).json({ error: "Images only" });
  next(err);
});
