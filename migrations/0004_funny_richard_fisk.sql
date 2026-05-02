CREATE TYPE "public"."friend_request_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"from_user" text NOT NULL,
	"to_user" text NOT NULL,
	"status" "friend_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friend_requests_from_user_to_user_unique" UNIQUE("from_user","to_user")
);
--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_users_sub_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("sub") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_users_sub_fk" FOREIGN KEY ("to_user") REFERENCES "public"."users"("sub") ON DELETE no action ON UPDATE no action;