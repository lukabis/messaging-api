ALTER TABLE "users" RENAME COLUMN "sub" TO "id";--> statement-breakpoint
ALTER TABLE "friend_requests" DROP CONSTRAINT "friend_requests_from_user_users_sub_fk";
--> statement-breakpoint
ALTER TABLE "friend_requests" DROP CONSTRAINT "friend_requests_to_user_users_sub_fk";
--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_users_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;