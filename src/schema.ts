import { pgTable, text, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  sub: text("sub").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username").unique(),
  onboarded: boolean("onboarded").default(false),
  profileImage: text("profile_image"),
});
