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

describe("Friends API", () => {
  beforeEach(async () => {
    mockAuth.userId = "user-1";
    await seedUser("user-1");
    await seedUser("user-2");
    await seedUser("user-3");
  });

  afterEach(async () => {
    await db.delete(friendRequests);
    await db.delete(users);
  });

  describe("POST /api/friend-requests", () => {
    it("returns 400 if toUser missing", async () => {
      const res = await request(app).post("/api/friend-requests").send({});
      expect(res.status).toBe(400);
    });

    it("returns 400 if sending to self", async () => {
      const res = await request(app).post("/api/friend-requests").send({ toUser: "user-1" });
      expect(res.status).toBe(400);
    });

    it("returns 409 if A→B request already exists", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2" });
      const res = await request(app).post("/api/friend-requests").send({ toUser: "user-2" });
      expect(res.status).toBe(409);
    });

    it("returns 409 if B→A request already exists", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
      const res = await request(app).post("/api/friend-requests").send({ toUser: "user-2" });
      expect(res.status).toBe(409);
    });

    it("returns 201 and creates request", async () => {
      const res = await request(app).post("/api/friend-requests").send({ toUser: "user-2" });
      expect(res.status).toBe(201);
      expect(res.body.fromUser).toBe("user-1");
      expect(res.body.toUser).toBe("user-2");
      expect(res.body.status).toBe("PENDING");
    });

    it("returns 404 if toUser does not exist", async () => {
      const res = await request(app)
        .post("/api/friend-requests")
        .send({ toUser: "non-existent-user" });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("request sent to non-existing user");
    });
  });

  describe("PATCH /api/friend-requests/:fromUser", () => {
    beforeEach(async () => {
      await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    });

    it("returns 400 if status invalid", async () => {
      const res = await request(app)
        .patch("/api/friend-requests/user-2")
        .send({ status: "INVALID" });
      expect(res.status).toBe(400);
    });

    it("returns 400 if status is PENDING", async () => {
      const res = await request(app)
        .patch("/api/friend-requests/user-2")
        .send({ status: "PENDING" });
      expect(res.status).toBe(400);
    });

    it("returns 404 if sender tries to accept their own outgoing request", async () => {
      mockAuth.userId = "user-2";
      const res = await request(app)
        .patch("/api/friend-requests/user-2")
        .send({ status: "ACCEPTED" });
      expect(res.status).toBe(404);
    });

    it("returns 404 if request not found", async () => {
      const res = await request(app)
        .patch("/api/friend-requests/user-3")
        .send({ status: "ACCEPTED" });
      expect(res.status).toBe(404);
    });

    it("returns 200 and ACCEPTED status", async () => {
      const res = await request(app)
        .patch("/api/friend-requests/user-2")
        .send({ status: "ACCEPTED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACCEPTED");
    });
  });

  describe("DELETE /api/friend-requests/:fromUser", () => {
    beforeEach(async () => {
      await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    });

    it("returns 404 if request does not exist", async () => {
      const res = await request(app).delete("/api/friend-requests/user-3");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Friend request not found");
    });

    it("returns 200 and the deleted record when request exists", async () => {
      const res = await request(app).delete("/api/friend-requests/user-2");
      expect(res.status).toBe(200);
      expect(res.body.fromUser).toBe("user-2");
      expect(res.body.toUser).toBe("user-1");
    });

    it("record is no longer present after deletion", async () => {
      await request(app).delete("/api/friend-requests/user-2");
      const res = await request(app).delete("/api/friend-requests/user-2");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Friend request not found");
    });
  });

  describe("GET /api/friends", () => {
    it("returns empty array if no accepted requests", async () => {
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns friends from sent accepted requests", async () => {
      await db
        .insert(friendRequests)
        .values({ fromUser: "user-1", toUser: "user-2", status: "ACCEPTED" });
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("user-2");
    });

    it("returns friends from received accepted requests", async () => {
      await db
        .insert(friendRequests)
        .values({ fromUser: "user-2", toUser: "user-1", status: "ACCEPTED" });
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("user-2");
    });

    it("does not return PENDING requests", async () => {
      await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2" });
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});

describe("GET /api/friends/search", () => {
  beforeEach(async () => {
    mockAuth.userId = "user-1";
    await seedUser("user-1", { firstName: "Current", lastName: "User", username: "current_user" });
    await seedUser("user-2", { firstName: "Alice", lastName: "Smith", username: "alice_smith" });
    await seedUser("user-3", { firstName: "Bob", lastName: "Jones", username: "bob_jones" });
  });

  afterEach(async () => {
    await db.delete(friendRequests);
    await db.delete(users);
  });

  it("returns [] if q is missing", async () => {
    const res = await request(app).get("/api/friends/search");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns [] if q is 1 char", async () => {
    const res = await request(app).get("/api/friends/search?q=a");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns [] if q is 2 chars", async () => {
    const res = await request(app).get("/api/friends/search?q=al");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns [] if q has 3+ chars but no match", async () => {
    const res = await request(app).get("/api/friends/search?q=xyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("matches by firstName", async () => {
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("user-2");
  });

  it("matches by lastName", async () => {
    const res = await request(app).get("/api/friends/search?q=Jon");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("user-3");
  });

  it("matches by username", async () => {
    const res = await request(app).get("/api/friends/search?q=alice_sm");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("user-2");
  });

  it("match is case-insensitive", async () => {
    const res = await request(app).get("/api/friends/search?q=ALICE");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("user-2");
  });

  it("does not return the authenticated user even if name matches", async () => {
    const res = await request(app).get("/api/friends/search?q=cur");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns relationship not_friends when no request exists", async () => {
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body[0].relationship).toBe("not_friends");
  });

  it("returns relationship friends when request is ACCEPTED", async () => {
    await db
      .insert(friendRequests)
      .values({ fromUser: "user-1", toUser: "user-2", status: "ACCEPTED" });
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body[0].relationship).toBe("friends");
  });

  it("returns relationship friends when received request is ACCEPTED", async () => {
    await db
      .insert(friendRequests)
      .values({ fromUser: "user-2", toUser: "user-1", status: "ACCEPTED" });
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body[0].relationship).toBe("friends");
  });

  it("returns relationship pending_sent when current user sent PENDING request", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2" });
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body[0].relationship).toBe("pending_sent");
  });

  it("returns relationship pending_received when other user sent PENDING request", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body[0].relationship).toBe("pending_received");
  });

  it("returns correct relationship for each user in multi-result search", async () => {
    await seedUser("user-4", { firstName: "Alice", lastName: "Cooper", username: "alice_cooper" });
    await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2", status: "ACCEPTED" });
    await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-4" });

    const res = await request(app).get("/api/friends/search?q=Ali");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const user2 = res.body.find((u: any) => u.id === "user-2");
    const user4 = res.body.find((u: any) => u.id === "user-4");
    expect(user2.relationship).toBe("friends");
    expect(user4.relationship).toBe("pending_sent");
  });
});

describe("GET /api/friend-requests", () => {
  beforeEach(async () => {
    mockAuth.userId = "user-1";
    await seedUser("user-1", { firstName: "Current", lastName: "User", username: "current_user" });
    await seedUser("user-2", { firstName: "Alice", lastName: "Smith", username: "alice_smith" });
    await seedUser("user-3", { firstName: "Bob", lastName: "Jones", username: "bob_jones" });
  });

  afterEach(async () => {
    await db.delete(friendRequests);
    await db.delete(users);
  });

  it("returns [] when no pending requests exist", async () => {
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns sender's user object for a single incoming PENDING request", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("user-2");
  });

  it("returns multiple senders when multiple incoming PENDING requests exist", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    await db.insert(friendRequests).values({ fromUser: "user-3", toUser: "user-1" });
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const ids = res.body.map((u: any) => u.id);
    expect(ids).toContain("user-2");
    expect(ids).toContain("user-3");
  });

  it("does not return ACCEPTED requests", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1", status: "ACCEPTED" });
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("does not return outgoing requests sent by current user", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-1", toUser: "user-2" });
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns user object shape (not the friend_request row)", async () => {
    await db.insert(friendRequests).values({ fromUser: "user-2", toUser: "user-1" });
    const res = await request(app).get("/api/friend-requests");
    expect(res.status).toBe(200);
    const user = res.body[0];
    expect(user.id).toBe("user-2");
    expect(user.username).toBe("alice_smith");
    expect(user.firstName).toBe("Alice");
    expect(user.lastName).toBe("Smith");
    expect(user).not.toHaveProperty("fromUser");
    expect(user).not.toHaveProperty("toUser");
    expect(user).not.toHaveProperty("status");
  });
});
