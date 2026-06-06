import express, { Request, Response } from "express";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "../db.js";
import { friendRequests, messages, users } from "../schema.js";
import { checkJwt } from "../middleware.js";
import { clients } from "../ws.js";

export const messagesRouter = express.Router();

messagesRouter.get("/messages/:friendId", checkJwt, async (req: Request, res: Response) => {
  const currentUserId = req.auth!.payload.sub! as string;
  const friendId = req.params.friendId as string;

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

  const msgs = await db
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.fromUserId, currentUserId), eq(messages.toUserId, friendId)),
        and(eq(messages.fromUserId, friendId), eq(messages.toUserId, currentUserId))
      )
    )
    .orderBy(asc(messages.createdAt));

  res.status(200).json({ friend, messages: msgs });
});

messagesRouter.post("/messages/:friendId", checkJwt, async (req: Request, res: Response) => {
  const currentUserId = req.auth!.payload.sub! as string;
  const friendId = req.params.friendId as string;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

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

  const [message] = await db
    .insert(messages)
    .values({ fromUserId: currentUserId, toUserId: friendId, text })
    .returning();

  const recipientSocket = clients.get(friendId);
  if (recipientSocket) {
    recipientSocket.send(JSON.stringify(message));
  }

  res.status(201).json(message);
});
