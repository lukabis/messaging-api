import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../schema.js";
import { checkJwt } from "../middleware.js";

async function cleanupFile(file: Express.Multer.File | undefined): Promise<void> {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (err) {
    console.error(`Failed to cleanup file: ${file.path}`, err);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Images only"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const userRouter = express.Router();

userRouter.get("/user", checkJwt, async (req: Request, res: Response) => {
  const token = req.headers.authorization!.split(" ")[1];
  const userInfoRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const userInfo = await userInfoRes.json();

  if (!userInfo.sub) {
    return res.status(401).json({ error: "Unable to fetch user info" });
  }

  const { sub: id, email, given_name, family_name } = userInfo;

  let [user] = await db
    .insert(users)
    .values({ id, email, firstName: given_name ?? null, lastName: family_name ?? null })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    [user] = await db.select().from(users).where(eq(users.id, id));
  }

  res.status(200).json(user);
});

userRouter.patch(
  "/user",
  checkJwt,
  upload.single("profileImage"),
  async (req: Request, res: Response) => {
    const { firstName, lastName, username, onboarded: rawOnboarded } = req.body;

    let onboarded: boolean | undefined;
    if (rawOnboarded !== undefined) {
      if (rawOnboarded === true || rawOnboarded === "true") onboarded = true;
      else if (rawOnboarded === false || rawOnboarded === "false") onboarded = false;
      else {
        await cleanupFile(req.file);
        return res.status(400).json({ error: "onboarded must be a boolean" });
      }
    }

    if (!firstName || !lastName || !username) {
      await cleanupFile(req.file);
      return res.status(400).json({ error: "First name, last name and username are required" });
    }
    if ([firstName, lastName, username].some((v) => v.length < 3)) {
      await cleanupFile(req.file);
      return res.status(400).json({ error: "Each field must be at least 3 characters" });
    }

    const id = req.auth!.payload.sub!;
    const profileImage = req.file ? `/uploads/${req.file.filename}` : undefined;

    try {
      let oldProfileImage: string | null = null;
      if (profileImage) {
        const [current] = await db
          .select({ profileImage: users.profileImage })
          .from(users)
          .where(eq(users.id, id));
        oldProfileImage = current?.profileImage ?? null;
      }

      const [user] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          username,
          ...(onboarded !== undefined && { onboarded }),
          ...(profileImage !== undefined && { profileImage }),
        })
        .where(eq(users.id, id))
        .returning();

      if (oldProfileImage) {
        fs.unlink(path.join("uploads", path.basename(oldProfileImage)), () => {});
      }

      res.status(200).json(user);
    } catch (err: any) {
      if (err.cause?.constraint === "users_username_unique") {
        await cleanupFile(req.file);
        return res.status(409).json({ error: "Username already taken" });
      }
      throw err;
    }
  }
);
