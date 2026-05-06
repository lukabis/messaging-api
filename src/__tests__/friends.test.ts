import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";
import { users, friendRequests } from "../schema.js";

const mockAuth = vi.hoisted(() => ({ userId: "user-1" }));

vi.mock("../middleware.js", () => ({
  checkJwt: (req: any, _res: any, next: any) => {
    req.auth = { payload: { sub: mockAuth.userId } };
    next();
  },
}));

async function seedUser(id: string) {
  await db.insert(users).values({ id, email: `${id}@test.com` });
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

    it("returns 200 and DECLINED status", async () => {
      const res = await request(app)
        .patch("/api/friend-requests/user-2")
        .send({ status: "DECLINED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DECLINED");
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

    it("does not return DECLINED requests", async () => {
      await db
        .insert(friendRequests)
        .values({ fromUser: "user-1", toUser: "user-2", status: "DECLINED" });
      const res = await request(app).get("/api/friends");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
