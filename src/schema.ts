import { pgTable, pgEnum, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const friendRequestStatusEnum = pgEnum("friend_request_status", ["PENDING", "ACCEPTED", "DECLINED"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  onboarded: boolean("onboarded").default(false),
  profileImage: text("profile_image"),
});

export const friendRequests = pgTable("friend_requests", {
  fromUser: text("from_user").notNull().references(() => users.id),
  toUser: text("to_user").notNull().references(() => users.id),
  status: friendRequestStatusEnum("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [unique().on(t.fromUser, t.toUser)]);
