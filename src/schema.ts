import { pgTable, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  sub: text("sub").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
});
