import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";
import { users, friendRequests } from "../schema.js";

import { mockAuth } from "../__mocks__/middleware.js";

vi.mock("../middleware.js");

async function seedUser(
  id: string,
  profile?: { firstName?: string; lastName?: string; username?: string }
) {
  await db.insert(users).values({ id, email: `${id}@test.com`, ...profile });
}

describe("Messages API", () => {
  beforeEach(async () => {
    mockAuth.userId = "user-1";
    await seedUser("user-1", { firstName: "Alice", lastName: "Smith", username: "alicesmith" });
    await seedUser("user-2", { firstName: "Bob", lastName: "Jones", username: "bobjones" });
    await seedUser("user-3", { firstName: "Carol", lastName: "White", username: "carolwhite" });
  });

  afterEach(async () => {
    await db.delete(friendRequests);
    await db.delete(users);
  });

  describe("GET /api/messages/:friendId", () => {
    it("returns 403 if not friends", async () => {
      const res = await request(app).get("/api/messages/user-2");
      expect(res.status).toBe(403);
    });

    it("returns 403 if friendship is pending (not accepted)", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2", status: "PENDING" });
      const res = await request(app).get("/api/messages/user-2");
      expect(res.status).toBe(403);
    });

    it("returns 200 with friend data when user-1 sent the request", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2", status: "ACCEPTED" });
      const res = await request(app).get("/api/messages/user-2");
      expect(res.status).toBe(200);
      expect(res.body.friend.id).toBe("user-2");
      expect(res.body.friend.firstName).toBe("Bob");
      expect(res.body.friend.lastName).toBe("Jones");
      expect(res.body.friend.username).toBe("bobjones");
    });

    it("returns 200 with friend data when user-2 sent the request", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1", status: "ACCEPTED" });
      const res = await request(app).get("/api/messages/user-2");
      expect(res.status).toBe(200);
      expect(res.body.friend.id).toBe("user-2");
      expect(res.body.friend.firstName).toBe("Bob");
      expect(res.body.friend.lastName).toBe("Jones");
      expect(res.body.friend.username).toBe("bobjones");
    });
  });
});
