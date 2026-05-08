import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../db.js";
import { users } from "../schema.js";

vi.mock("../middleware.js");

function mockAuth0UserInfo(userInfo: object) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(userInfo) }));
}

async function seedUser(id: string, extra: object = {}) {
  await db.insert(users).values({ id, email: `${id}@test.com`, ...extra });
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete(users);
});

describe("GET /user", () => {
  it("inserts and returns new user", async () => {
    mockAuth0UserInfo({
      sub: "user-1",
      email: "user-1@test.com",
      given_name: "Alice",
      family_name: "Smith",
    });
    const res = await request(app).get("/api/user").set("Authorization", "Bearer test-token");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("user-1");
    expect(res.body.email).toBe("user-1@test.com");
  });

  it("returns existing user without re-inserting", async () => {
    await seedUser("user-1", { username: "alice123", firstName: "Alice", lastName: "Smith" });
    mockAuth0UserInfo({ sub: "user-1", email: "user-1@test.com" });
    const res = await request(app).get("/api/user").set("Authorization", "Bearer test-token");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("alice123");
  });

  it("returns 401 if Auth0 returns no sub", async () => {
    mockAuth0UserInfo({ error: "unauthorized" });
    const res = await request(app).get("/api/user").set("Authorization", "Bearer test-token");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /user", () => {
  beforeEach(async () => {
    await seedUser("user-1");
  });

  it("returns 400 if required fields missing", async () => {
    const res = await request(app).patch("/api/user").send({ firstName: "Alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 if any field shorter than 3 chars", async () => {
    const res = await request(app)
      .patch("/api/user")
      .send({ firstName: "Al", lastName: "Smith", username: "alice123" });
    expect(res.status).toBe(400);
  });

  it("returns 400 if onboarded is invalid", async () => {
    const res = await request(app)
      .patch("/api/user")
      .send({ firstName: "Alice", lastName: "Smith", username: "alice123", onboarded: "maybe" });
    expect(res.status).toBe(400);
  });

  it("returns 409 if username already taken", async () => {
    await seedUser("user-2", { username: "taken123" });
    const res = await request(app)
      .patch("/api/user")
      .send({ firstName: "Alice", lastName: "Smith", username: "taken123" });
    expect(res.status).toBe(409);
  });

  it("returns 200 and updated user", async () => {
    const res = await request(app)
      .patch("/api/user")
      .send({ firstName: "Alice", lastName: "Smith", username: "alice123", onboarded: true });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Alice");
    expect(res.body.lastName).toBe("Smith");
    expect(res.body.username).toBe("alice123");
    expect(res.body.onboarded).toBe(true);
  });
});
