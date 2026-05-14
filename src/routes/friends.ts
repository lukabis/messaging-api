import express, { Request, Response } from "express";
import { and, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { db } from "../db.js";
import { friendRequests, users } from "../schema.js";
import { checkJwt } from "../middleware.js";

export const friendsRouter = express.Router();

friendsRouter.post("/friend-requests", checkJwt, async (req: Request, res: Response) => {
  const fromUser = req.auth!.payload.sub! as string;
  const { toUser } = req.body;

  if (!toUser) {
    return res.status(400).json({ error: "toUser is required" });
  }
  if (fromUser === toUser) {
    return res.status(400).json({ error: "Cannot send a friend request to yourself" });
  }

  const [existing] = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.fromUser, fromUser), eq(friendRequests.toUser, toUser)),
        and(eq(friendRequests.fromUser, toUser), eq(friendRequests.toUser, fromUser))
      )
    )
    .limit(1);

  if (existing) {
    return res.status(409).json({ error: "Friend request already exists" });
  }

  try {
    const [request] = await db.insert(friendRequests).values({ fromUser, toUser }).returning();

    res.status(201).json(request);
  } catch (err: any) {
    if (err.constraint === "friend_requests_from_user_to_user_unique") {
      return res.status(409).json({ error: "Friend request already exists" });
    }
    throw err;
  }
});

friendsRouter.patch("/friend-requests/:fromUser", checkJwt, async (req: Request, res: Response) => {
  const toUser = req.auth!.payload.sub! as string;
  const fromUser = req.params.fromUser as string;
  const status: "ACCEPTED" | undefined = req.body.status;

  if (status !== "ACCEPTED") {
    return res.status(400).json({ error: "status must be ACCEPTED" });
  }

  const [updated] = await db
    .update(friendRequests)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(friendRequests.fromUser, fromUser), eq(friendRequests.toUser, toUser)))
    .returning();

  if (!updated) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  res.status(200).json(updated);
});

type RelationshipStatus = "friends" | "pending_sent" | "pending_received" | "not_friends";

friendsRouter.get("/friends/search", checkJwt, async (req: Request, res: Response) => {
  const currentUserId = req.auth!.payload.sub! as string;
  const q = (req.query.q as string) ?? "";

  if (q.length <= 2) {
    return res.status(200).json([]);
  }

  const matchedUsers = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, currentUserId),
        or(
          ilike(users.firstName, `%${q}%`),
          ilike(users.lastName, `%${q}%`),
          ilike(users.username, `%${q}%`)
        )
      )
    );

  if (matchedUsers.length === 0) {
    return res.status(200).json([]);
  }

  const matchedIds = matchedUsers.map((u) => u.id);

  const requests = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.fromUser, currentUserId), inArray(friendRequests.toUser, matchedIds)),
        and(eq(friendRequests.toUser, currentUserId), inArray(friendRequests.fromUser, matchedIds))
      )
    );

  const result = matchedUsers.map((user) => {
    const request = requests.find(
      (r) =>
        (r.fromUser === currentUserId && r.toUser === user.id) ||
        (r.fromUser === user.id && r.toUser === currentUserId)
    );

    let relationship: RelationshipStatus = "not_friends";
    if (request) {
      if (request.status === "ACCEPTED") {
        relationship = "friends";
      } else if (request.status === "PENDING") {
        relationship = request.fromUser === currentUserId ? "pending_sent" : "pending_received";
      }
    }

    return { ...user, relationship };
  });

  res.status(200).json(result);
});

friendsRouter.get("/friends", checkJwt, async (req: Request, res: Response) => {
  const id = req.auth!.payload.sub! as string;

  const [sent, received] = await Promise.all([
    db
      .select({ friend: users })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.toUser))
      .where(and(eq(friendRequests.fromUser, id), eq(friendRequests.status, "ACCEPTED"))),
    db
      .select({ friend: users })
      .from(friendRequests)
      .innerJoin(users, eq(users.id, friendRequests.fromUser))
      .where(and(eq(friendRequests.toUser, id), eq(friendRequests.status, "ACCEPTED"))),
  ]);

  res.status(200).json([...sent, ...received].map(({ friend }) => friend));
});
