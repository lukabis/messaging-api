import express, { Request, Response } from "express";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db.js";
import { friendRequests, users } from "../schema.js";
import { checkJwt } from "../middleware.js";

export const messagesRouter = express.Router();

messagesRouter.get("/messages/:friendId", checkJwt, async (req: Request, res: Response) => {
  const currentUserId = req.auth!.payload.sub! as string;
  const { friendId } = req.params;

  const [friendship] = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        or(
          and(eq(friendRequests.fromUser, currentUserId), eq(friendRequests.toUser, friendId)),
          and(eq(friendRequests.fromUser, friendId), eq(friendRequests.toUser, currentUserId))
        ),
        eq(friendRequests.status, "ACCEPTED")
      )
    )
    .limit(1);

  if (!friendship) {
    return res.status(403).json({ error: "Not friends with this user" });
  }

  const [friend] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      profileImage: users.profileImage,
    })
    .from(users)
    .where(eq(users.id, friendId))
    .limit(1);

  // TODO: fetch messages
  res.status(200).json({ friend, messages: [] });
});
